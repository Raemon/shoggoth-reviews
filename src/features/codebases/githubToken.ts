import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';

interface GithubAuth {
  token: string | null;
  rejected: Set<string>;
}

const requestAuth = new AsyncLocalStorage<GithubAuth>();

export function withGithubToken<T>(token: string | null, work: () => Promise<T>): Promise<T> {
  return requestAuth.run({ token, rejected: new Set() }, work);
}

export function userGithubToken(): string | null {
  return requestAuth.getStore()?.token ?? null;
}

export function githubToken(): string | null {
  return usable(userGithubToken());
}

export function rejectGithubToken(token: string): void {
  requestAuth.getStore()?.rejected.add(token);
}

export function userGithubTokenRejected(): boolean {
  const auth = requestAuth.getStore();
  return auth?.token != null && auth.rejected.has(auth.token);
}

export function githubTokenIdentity(): string {
  const token = githubToken();
  return token ? createHash('sha256').update(token).digest('hex').slice(0, 16) : 'anonymous';
}

function usable(token: string | null | undefined): string | null {
  const rejected = requestAuth.getStore()?.rejected;
  return token && !rejected?.has(token) ? token : null;
}
