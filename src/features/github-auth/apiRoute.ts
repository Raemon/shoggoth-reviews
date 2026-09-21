import { GithubRequestError } from '@/features/codebases/githubRequest';
import { userGithubTokenRejected, withGithubToken } from '@/features/codebases/githubToken';
import { errorMessage } from '@/features/sources/errorMessage';
import { GITHUB_AUTH_HEADER, GITHUB_AUTH_REJECTED } from './githubAuthHeader';

export function apiRoute<T>(request: Request, work: () => Promise<T>): Promise<Response> {
  return withGithubToken(bearerToken(request), async () => {
    try {
      return jsonResponse(await work());
    } catch (error) {
      return jsonResponse({ error: errorMessage(error) }, errorStatus(error));
    }
  });
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
