import { decodePathSegments, repoRoute } from './repoPaths';
import { BRANCH_NAME_PATTERN, PULL_NUMBER_PATTERN } from '@/features/pull-requests/routeParams';
import { pullRoute } from '@/features/pull-requests/pullPaths';
import { parseRepoLink, type RepoRef } from '@/features/sources/parseRepoLink';

const GITHUB_HOST = /^(?:www\.)?github\.com$/i;
const REPO_LANDING_SECTIONS = new Set(['pulls', 'branches', 'commits']);

export function githubUrlRoute(href: string): string | null {
  const url = parseUrl(href);
  if (url === null || !GITHUB_HOST.test(url.hostname)) return null;
  const [owner, repo, ...rest] = decodePathSegments(url.pathname);
  if (owner === undefined || repo === undefined) return null;
  return repoSubpathRoute(owner, repo, rest);
}

export function repoSubpathRoute(owner: string, repo: string, rest: string[]): string | null {
  const parsed = parseRepoLink(`${owner}/${repo}`);
  return parsed.ok ? sectionRoute(parsed.value, rest) : null;
}

function sectionRoute({ owner, name }: RepoRef, [section, ...tail]: string[]): string | null {
  if (section === undefined) return repoRoute(owner, name);
  if (section === 'pull') return pullSectionRoute(owner, name, tail[0]);
  if (section === 'tree' || section === 'blob') return refSectionRoute(owner, name, tail);
  return REPO_LANDING_SECTIONS.has(section) ? repoRoute(owner, name) : null;
}

function pullSectionRoute(owner: string, repo: string, number: string | undefined): string | null {
  if (number === undefined || !PULL_NUMBER_PATTERN.test(number)) return null;
  return pullRoute(owner, repo, Number(number));
}

function refSectionRoute(owner: string, repo: string, tail: string[]): string | null {
  const [ref] = tail;
  if (ref === undefined || ref === 'HEAD' || !BRANCH_NAME_PATTERN.test(ref)) return null;
  return `${repoRoute(owner, repo)}/tree/${tail.map(encodeURIComponent).join('/')}`;
}

function parseUrl(href: string): URL | null {
  try {
    return new URL(href);
  } catch {
    return null;
  }
}
