import { cacheKey, dropCachedScope, readCachedResponse, writeCachedResponse, type CachedResponse } from './githubCache';
import { githubToken, githubTokenIdentity, rejectGithubToken } from './githubToken';
import { COMMIT_SHA_PATTERN } from '@/features/sources/sourceTypes';

export class GithubRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const ACCEPT = 'application/vnd.github+json';
export const PAGE_SIZE = 100;
const DEFAULT_FRESHNESS_MS = 30_000;
const IMMUTABLE_PATTERNS = [/\/(?:commits|git\/trees|tarball)\/[0-9a-f]{40}$/];
const STALE_ON_STATUS = [403, 408, 429, 500, 502, 503, 504];

const inFlight = new Map<string, Promise<CachedResponse>>();

type BodyStream = ReadableStream<Uint8Array> | null;
type Derive<T> = (body: BodyStream) => Promise<T>;
type Derivation = { what: string; derive: Derive<string> };

export async function githubJson<T>(url: string, fresh = false): Promise<T> {
  return JSON.parse(decodeBody(await cachedResponse(url, ACCEPT, fresh)).toString('utf8')) as T;
}

export async function githubJsonPages<T>(url: string, maxPages: number, fresh = false): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const batch = await githubJson<T[]>(githubPageUrl(url, page), fresh);
    items.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return items;
}

export function githubPageUrl(url: string, page: number): string {
  return `${url}${url.includes('?') ? '&' : '?'}per_page=${PAGE_SIZE}&page=${page}`;
}

export async function githubBytes(url: string, accept: string): Promise<Uint8Array> {
  return new Uint8Array(decodeBody(await cachedResponse(url, accept)));
}

// Stores only derive()'s output, so a tarball never sits in memory or the cache.
export async function githubDerived<T>(url: string, what: string, derive: Derive<T>): Promise<T> {
  const stored = { what, derive: async (body: BodyStream) => JSON.stringify(await derive(body)) };
  return JSON.parse(decodeBody(await cachedResponse(url, ACCEPT, false, stored)).toString('utf8')) as T;
}

export async function githubSend<T>(url: string, method: string, body: unknown): Promise<T> {
  const tokenUsed = githubToken();
  const response = await fetch(url, {
    method,
    cache: 'no-store',
    headers: { ...githubHeaders(ACCEPT, tokenUsed), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  await dropCachedScope(scopeOf(url));
  if (!response.ok) {
    rejectIfUnauthorized(response.status, tokenUsed);
    throw new GithubRequestError(response.status, await describeSendFailure(response, url));
  }
  // GitHub answers some successful writes (a merge with nothing to do) with 204 and no body.
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export async function dropGithubCache(owner: string, name: string): Promise<void> {
  await dropCachedScope(`repos/${owner}/${name}`);
}

export async function githubGraphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const url = 'https://api.github.com/graphql';
  const tokenUsed = githubToken();
  const response = await fetch(url, {
    method: 'POST',
    cache: 'no-store',
    headers: { ...githubHeaders('application/json', tokenUsed), 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    rejectIfUnauthorized(response.status, tokenUsed);
    throw new GithubRequestError(response.status, await describeSendFailure(response, url));
  }
  const payload = (await response.json()) as { data?: T; errors?: { message?: string }[] };
  const failure = payload.errors?.[0]?.message;
  if (failure) throw new GithubRequestError(response.status, failure);
  return payload.data as T;
}

async function cachedResponse(
  url: string,
  accept: string,
  fresh = false,
  derivation: Derivation | null = null,
): Promise<CachedResponse> {
  const scope = scopeOf(url);
  const key = responseKey(url, accept, derivation);
  const held = await readCachedResponse(scope, key);
  if (held && !fresh && Date.now() - held.storedAt < freshnessOf(url)) return held;
  return shareInFlight(scope + key + (fresh ? ':fresh' : ''), () =>
    revalidate(url, accept, scope, key, held, fresh, derivation),
  );
}

function responseKey(url: string, accept: string, derivation: Derivation | null): string {
  const base = [githubTokenIdentity(), url, accept];
  return cacheKey(derivation ? [...base, `derived:${derivation.what}`] : base);
}

function shareInFlight(key: string, work: () => Promise<CachedResponse>): Promise<CachedResponse> {
  const running = inFlight.get(key);
  if (running) return running;
  const pending = work().finally(() => inFlight.delete(key));
  inFlight.set(key, pending);
  return pending;
}

async function revalidate(
  url: string,
  accept: string,
  scope: string,
  key: string,
  held: CachedResponse | null,
  fresh: boolean,
  derivation: Derivation | null,
): Promise<CachedResponse> {
  const tokenUsed = githubToken();
  const fallback = fresh ? null : held;
  const response = await fetch(url, { cache: 'no-store', headers: conditionalHeaders(accept, held, tokenUsed) }).catch(() => null);
  if (!response) return unreachable(url, fallback);
  if (response.status === 304 && held) return store(scope, key, { ...held, storedAt: Date.now() });
  if (response.status === 401 && tokenUsed) return readAfterRejectedToken(url, accept, tokenUsed, response, derivation);
  if (!response.ok) return staleOrThrow(response, url, fallback);
  return store(scope, key, await capture(response, derivation));
}

function unreachable(url: string, held: CachedResponse | null): CachedResponse {
  if (held) return held;
  throw new GithubRequestError(503, `GitHub is unreachable for ${url}`);
}

function staleOrThrow(response: Response, url: string, held: CachedResponse | null): CachedResponse {
  if (held && STALE_ON_STATUS.includes(response.status)) return held;
  throw new GithubRequestError(response.status, describeFailure(response, url));
}

async function readAfterRejectedToken(
  url: string,
  accept: string,
  tokenUsed: string,
  unauthorized: Response,
  derivation: Derivation | null,
): Promise<CachedResponse> {
  rejectGithubToken(tokenUsed);
  if (githubToken() === tokenUsed) throw unauthorizedError(unauthorized, url);
  try {
    return await cachedResponse(url, accept, false, derivation);
  } catch (error) {
    throw remapUnauthorizedFallback(error, unauthorized, url);
  }
}

function unauthorizedError(response: Response, url: string): GithubRequestError {
  return new GithubRequestError(401, describeFailure(response, url));
}

function remapUnauthorizedFallback(error: unknown, unauthorized: Response, url: string): unknown {
  if (error instanceof GithubRequestError && (error.status === 401 || error.status === 404)) {
    return unauthorizedError(unauthorized, url);
  }
  return error;
}

async function capture(response: Response, derivation: Derivation | null): Promise<CachedResponse> {
  const storedAsText = derivation !== null || /json|text|javascript/.test(response.headers.get('content-type') ?? '');
  return {
    status: response.status,
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
    storedAt: Date.now(),
    encoding: storedAsText ? 'utf8' : 'base64',
    body: await storedBody(response, derivation, storedAsText),
  };
}

async function storedBody(response: Response, derivation: Derivation | null, storedAsText: boolean): Promise<string> {
  if (derivation) return derivation.derive(response.body);
  return Buffer.from(await response.arrayBuffer()).toString(storedAsText ? 'utf8' : 'base64');
}

async function store(scope: string, key: string, entry: CachedResponse): Promise<CachedResponse> {
  await writeCachedResponse(scope, key, entry);
  return entry;
}

function decodeBody(entry: CachedResponse): Buffer {
  return Buffer.from(entry.body, entry.encoding);
}

function freshnessOf(url: string): number {
  return pinnedToCommit(url) ? Number.POSITIVE_INFINITY : DEFAULT_FRESHNESS_MS;
}

function pinnedToCommit(url: string): boolean {
  if (IMMUTABLE_PATTERNS.some((pattern) => pattern.test(pathOf(url)))) return true;
  return COMMIT_SHA_PATTERN.test(refParamOf(url) ?? '');
}

function refParamOf(url: string): string | null {
  try {
    return new URL(url).searchParams.get('ref');
  } catch {
    return null;
  }
}

function scopeOf(url: string): string {
  const segments = pathOf(url).split('/').filter(Boolean);
  if (segments[0] === 'repos' && segments[1] && segments[2]) return `repos/${segments[1]}/${segments[2]}`;
  return segments[0] ?? 'root';
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function conditionalHeaders(accept: string, held: CachedResponse | null, token: string | null): Record<string, string> {
  const headers = githubHeaders(accept, token);
  if (held?.etag) headers['If-None-Match'] = held.etag;
  else if (held?.lastModified) headers['If-Modified-Since'] = held.lastModified;
  return headers;
}

async function describeSendFailure(response: Response, url: string): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  const message = (body as { message?: unknown } | null)?.message;
  return typeof message === 'string' && message ? message : describeFailure(response, url);
}

function describeFailure(response: Response, url: string): string {
  const exhausted = response.headers.get('x-ratelimit-remaining') === '0';
  if (exhausted) return `GitHub rate limit exhausted (${response.status} for ${url}); connect GitHub or set GITHUB_TOKEN`;
  if (response.status === 401) return `GitHub rejected the credentials for ${url}; reconnect GitHub`;
  return `GitHub ${response.status} for ${url}`;
}

function rejectIfUnauthorized(status: number, token: string | null): void {
  if (status === 401 && token) rejectGithubToken(token);
}

function githubHeaders(accept = ACCEPT, token = githubToken()): Record<string, string> {
  return {
    Accept: accept,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'reposcope',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
