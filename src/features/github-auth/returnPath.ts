import type { GithubAccess } from './githubAccess';

const PLACEHOLDER_ORIGIN = 'https://reposcope.invalid';

// Resolving catches "//x", "/\x" and "/\t/x", which browsers read as another origin.
export function returnPath(raw: string | null | undefined): string | null {
  if (!raw?.startsWith('/')) return null;
  try {
    const url = new URL(raw, PLACEHOLDER_ORIGIN);
    return url.origin === PLACEHOLDER_ORIGIN ? `${url.pathname}${url.search}` : null;
  } catch {
    return null;
  }
}

export function connectHref(access: GithubAccess, next: string): string {
  return `/api/github/connect?${new URLSearchParams({ access, next })}`;
}
