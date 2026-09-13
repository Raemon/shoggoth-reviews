import { parseRepoLink, type RepoRef } from '@/features/sources/parseRepoLink';

export function repoRoute(owner: string, repo: string): string {
  return `/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

export function pullBeingRead(pathname: string): number | null {
  const match = pathname.match(/^\/[^/]+\/[^/]+\/pull\/([0-9]{1,9})(?:\/|$)/);
  return match?.[1] ? Number(match[1]) : null;
}

export function branchBeingRead(pathname: string): string | null {
  const match = pathname.match(/^\/[^/]+\/[^/]+\/branch\/(.+)$/);
  if (!match?.[1]) return null;
  return decodePathSegments(match[1]).join('/');
}

export function decodePathSegments(pathname: string): string[] {
  return pathname.split('/').filter(Boolean).map(decodeSegment);
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
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
