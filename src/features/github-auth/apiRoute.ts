import { GithubRequestError } from '@/features/codebases/githubRequest';
import { holdGithubResponseSlot } from '@/features/codebases/githubMemoryBudget';
import { userGithubTokenRejected, withGithubToken } from '@/features/codebases/githubToken';
import { errorMessage } from '@/features/sources/errorMessage';
import { GITHUB_AUTH_HEADER, GITHUB_AUTH_REJECTED } from './githubAuthHeader';

export async function apiRoute<T>(request: Request, work: () => Promise<T>): Promise<Response> {
  let release: () => void;
  try {
    release = await holdGithubResponseSlot();
  } catch (error) {
    return jsonResponse({ error: errorMessage(error) }, errorStatus(error));
  }
  try {
    const response = await runRoute(request, work);
    return request.method === 'HEAD' ? await releaseHead(response, release) : releaseWithBody(response, release);
  } catch (error) {
    release();
    return jsonResponse({ error: errorMessage(error) }, errorStatus(error));
  }
}

async function releaseHead(response: Response, release: () => void): Promise<Response> {
  try {
    await response.body?.cancel();
  } finally {
    release();
  }
  return new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers });
}

function runRoute<T>(request: Request, work: () => Promise<T>): Promise<Response> {
  return withGithubToken(bearerToken(request), async () => {
    try {
      return jsonResponse(await work());
    } catch (error) {
      return jsonResponse({ error: errorMessage(error) }, errorStatus(error));
    }
  });
}

function releaseWithBody(response: Response, release: () => void): Response {
  const reader = response.body?.getReader();
  if (!reader) {
    release();
    return response;
  }
  const body = releasingStream(reader, release);
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

function releasingStream(reader: ReadableStreamDefaultReader<Uint8Array>, release: () => void): ReadableStream<Uint8Array> {
  return new ReadableStream({
    pull: (controller) => pullChunk(reader, controller, release),
    cancel: (reason) => cancelReader(reader, reason, release),
  });
}

async function pullChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  controller: ReadableStreamDefaultController<Uint8Array>,
  release: () => void,
): Promise<void> {
  try {
    finishChunk(await reader.read(), controller, release);
  } catch (error) {
    release();
    controller.error(error);
  }
}

function finishChunk(
  chunk: ReadableStreamReadResult<Uint8Array>,
  controller: ReadableStreamDefaultController<Uint8Array>,
  release: () => void,
): void {
  if (!chunk.done) return controller.enqueue(chunk.value);
  release();
  controller.close();
}

async function cancelReader(reader: ReadableStreamDefaultReader<Uint8Array>, reason: unknown, release: () => void) {
  try {
    await reader.cancel(reason);
  } finally {
    release();
  }
}

export function requireParam(request: Request, name: string, pattern: RegExp): string {
  const value = new URL(request.url).searchParams.get(name) ?? '';
  if (!pattern.test(value)) throw new GithubRequestError(400, `Missing or invalid ${name}`);
  return value;
}

export function optionalParam(request: Request, name: string, maxLength: number): string {
  return (new URL(request.url).searchParams.get(name) ?? '').slice(0, maxLength);
}

function bearerToken(request: Request): string | null {
  const match = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: rejectedAuthHeader() });
}

function rejectedAuthHeader(): Record<string, string> {
  return userGithubTokenRejected() ? { [GITHUB_AUTH_HEADER]: GITHUB_AUTH_REJECTED } : {};
}

function errorStatus(error: unknown): number {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' && status >= 400 && status < 600 ? status : 500;
}
