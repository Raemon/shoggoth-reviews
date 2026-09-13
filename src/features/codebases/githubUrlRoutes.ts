import { decodePathSegments, encodePath, repoRoute } from './repoPaths';
import { BRANCH_NAME_PATTERN, PULL_NUMBER_PATTERN } from '@/features/pull-requests/routeParams';
import { pullRoute } from '@/features/pull-requests/pullPaths';
import { parseRepoLink, type RepoRef } from '@/features/sources/parseRepoLink';

export type GithubTarget =
  | { kind: 'repo'; owner: string; repo: string }
  | { kind: 'pull'; owner: string; repo: string; number: number }
  | { kind: 'ref'; owner: string; repo: string; segments: string[] };

const GITHUB_HOST = /^(?:www\.)?github\.com$/i;
const REPO_LANDING_SECTIONS = new Set(['pulls', 'branches', 'commits']);
const RESERVED_OWNERS = new Set([
  'about', 'apps', 'collections', 'codespaces', 'contact', 'dashboard', 'enterprise', 'events', 'explore',
  'features', 'issues', 'join', 'login', 'marketplace', 'new', 'notifications', 'orgs', 'pricing', 'pulls',
  'search', 'security', 'settings', 'site', 'sponsors', 'topics', 'trending', 'users',
]);

export function githubUrlRoute(href: string): string | null {
  const url = parseUrl(href);
  if (url === null || !GITHUB_HOST.test(url.hostname)) return null;
  const [owner, repo, ...rest] = decodePathSegments(url.pathname);
  if (owner === undefined || repo === undefined) return null;
  const target = githubTarget(owner, repo, rest);
  return target === null ? null : `${targetRoute(target)}${url.search}${url.hash}`;
}

export function githubTarget(owner: string, repo: string, rest: string[]): GithubTarget | null {
  if (RESERVED_OWNERS.has(owner.toLowerCase())) return null;
  const parsed = parseRepoLink(`${owner}/${repo}`);
  return parsed.ok ? sectionTarget(parsed.value, rest) : null;
}

// A ref target keeps GitHub's own path shape, which the [...rest] page resolves to a branch.
export function targetRoute(target: GithubTarget): string {
  if (target.kind === 'pull') return pullRoute(target.owner, target.repo, target.number);
  if (target.kind === 'ref') return `${repoRoute(target.owner, target.repo)}/tree/${encodePath(target.segments.join('/'))}`;
  return repoRoute(target.owner, target.repo);
}

function sectionTarget({ owner, name: repo }: RepoRef, [section, ...tail]: string[]): GithubTarget | null {
  if (section === 'pull') return pullTarget(owner, repo, tail[0]);
  if (section === 'tree' || section === 'blob') return refTarget(owner, repo, tail);
  if (section === undefined || REPO_LANDING_SECTIONS.has(section)) return { kind: 'repo', owner, repo };
  return null;
}

function pullTarget(owner: string, repo: string, number: string | undefined): GithubTarget | null {
  if (number === undefined || !PULL_NUMBER_PATTERN.test(number)) return null;
  return { kind: 'pull', owner, repo, number: Number(number) };
}

function refTarget(owner: string, repo: string, segments: string[]): GithubTarget | null {
  const [ref] = segments;
  if (ref === undefined || ref === 'HEAD' || !BRANCH_NAME_PATTERN.test(ref)) return null;
  return { kind: 'ref', owner, repo, segments };
}

function parseUrl(href: string): URL | null {
  try {
    return new URL(href);
  } catch {
    return null;
  }
}
