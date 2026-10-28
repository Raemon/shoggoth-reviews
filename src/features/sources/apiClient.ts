import { GITHUB_AUTH_HEADER, GITHUB_AUTH_REJECTED } from '@/features/github-auth/githubAuthHeader';
import { freshGithubToken, replacementGithubToken } from './githubSession';

interface Call {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

class ApiClientError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function apiErrorStatus(error: unknown): number | null {
  return error instanceof ApiClientError ? error.status : null;
}

export async function apiJson<T>(path: string, token: string | null, signal?: AbortSignal): Promise<T> {
  return send<T>(path, token, { signal });
}

export async function apiPost<T>(path: string, token: string | null): Promise<T> {
  return send<T>(path, token, { method: 'POST' });
}

export async function apiPostJson<T>(path: string, token: string | null, body: unknown): Promise<T> {
  return send<T>(path, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function send<T>(path: string, token: string | null, call: Call): Promise<T> {
  const sent = await freshGithubToken(token);
  const response = await fetch(path, authorized(call, sent));
  return readJson<T>(tokenRejected(response) ? await retryRenewed(path, call, response, sent) : response);
}

async function retryRenewed(path: string, call: Call, rejected: Response, sent: string | null): Promise<Response> {
  const replacement = await replacementGithubToken(sent);
  if (replacement === null) return rejected;
  return fetch(path, authorized(call, replacement));
}

function authorized(call: Call, token: string | null): RequestInit {
  return { ...call, headers: { ...call.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) } };
}

function tokenRejected(response: Response): boolean {
  return response.headers.get(GITHUB_AUTH_HEADER) === GITHUB_AUTH_REJECTED;
}

async function readJson<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  if (response.ok) return body as T;
  const message =
    body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
      ? (body as { error: string }).error
      : `Request failed (${response.status})`;
  throw new ApiClientError(response.status, message);
}

export async function apiKeyedJson<T>(path: string, headers: Record<string, string>): Promise<T> {
  return readJson<T>(await fetch(path, { headers }));
}

export async function apiKeyedPost<T>(path: string, headers: Record<string, string>, body: unknown): Promise<T> {
  return readJson<T>(
    await fetch(path, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  );
}

export async function apiKeyedStream(path: string, headers: Record<string, string>): Promise<Response> {
  const response = await fetch(path, { headers });
  if (!response.ok || response.body === null) return readJson<never>(response);
  return response;
}
