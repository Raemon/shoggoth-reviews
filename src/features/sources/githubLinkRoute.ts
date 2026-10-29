import { repoRoute } from '@/features/codebases/repoPaths';
import { branchRoute, commitRoute, pullRoute } from '@/features/pull-requests/pullPaths';
import { PULL_NUMBER_PATTERN } from '@/features/pull-requests/routeParams';
import { LOGIN_PATTERN, REPO_NAME_PATTERN } from './sourceTypes';

// Next collapses the `//` in a pasted `https://` to `/` before routing, so accept either.
const GITHUB_PREFIX = /^\/(?:https?:\/+)?(?:www\.)?github\.com(?=\/|$)/;

export function githubLinkRoute(pathname: string): string | null {
  const prefix = pathname.match(GITHUB_PREFIX);
  if (!prefix) return null;
  const [owner, repo, kind, ...rest] = decodedSegments(pathname.slice(prefix[0].length));
  if (!owner || !repo || !LOGIN_PATTERN.test(owner) || !REPO_NAME_PATTERN.test(repo)) return null;
  return viewRoute(owner, repo, kind, rest);
}

function viewRoute(owner: string, repo: string, kind: string | undefined, rest: string[]): string | null {
  const target = rest.join('/');
  if (!kind) return repoRoute(owner, repo);
  if (kind === 'pull' && PULL_NUMBER_PATTERN.test(rest[0] ?? '')) return pullRoute(owner, repo, Number(rest[0]));
  if (kind === 'tree' && target) return branchRoute(owner, repo, target);
  if (kind === 'compare' && target) return compareRoute(owner, repo, target);
  if (kind === 'commit' && rest[0]) return commitRoute(owner, repo, rest[0]);
  return null;
}

// Git ref names can't contain `..` or `:`, so `base...owner:repo:head` splits unambiguously.
function compareRoute(owner: string, repo: string, spec: string): string {
  const head = spec.split(/\.{2,3}/).at(-1) ?? spec;
  const forkParts = head.split(':');
  const branch = forkParts.pop() ?? head;
  const [headOwner = owner, headRepo = repo] = forkParts;
  return branchRoute(headOwner, headRepo, branch);
}

function decodedSegments(path: string): string[] {
  return path.split('/').filter(Boolean).map(decodedSegment);
}

function decodedSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
