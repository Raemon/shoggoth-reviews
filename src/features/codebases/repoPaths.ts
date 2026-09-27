import { parseRepoLink, type RepoRef } from '@/features/sources/parseRepoLink';

export function repoRoute(owner: string, repo: string): string {
  return `/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

export function pullBeingRead(pathname: string): number | null {
  const match = pathname.match(/^\/[^/]+\/[^/]+\/pull\/([0-9]{1,9})(?:\/|$)/);
  return match?.[1] ? Number(match[1]) : null;
}

export function commitBeingRead(pathname: string): string | null {
  const match = pathname.match(/^\/[^/]+\/[^/]+\/commit\/([0-9a-f]{7,40})(?:\/|$)/);
  return match?.[1] ?? null;
}

export function branchBeingRead(pathname: string): string | null {
  const match = pathname.match(/^\/[^/]+\/[^/]+\/branch\/(.+)$/);
  if (!match?.[1]) return null;
  try {
    return match[1].split('/').map(decodeURIComponent).join('/');
  } catch {
    return match[1];
  }
}

export function repoBeingRead(pathname: string): RepoRef | null {
  const segments = pathname.match(/^\/([^/]+)\/([^/]+)(?:\/|$)/);
  if (!segments?.[1] || !segments[2]) return null;
  try {
    const parsed = parseRepoLink(`${decodeURIComponent(segments[1])}/${decodeURIComponent(segments[2])}`);
    return parsed.ok ? parsed.value : null;
  } catch {
    return null;
  }
}
