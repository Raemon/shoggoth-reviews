import { repoRoute } from './repoPaths';
import { BRANCH_NAME_PATTERN, PULL_NUMBER_PATTERN } from '@/features/pull-requests/routeParams';
import { branchRoute, pullRoute } from '@/features/pull-requests/pullPaths';
import { LOGIN_PATTERN, REPO_NAME_PATTERN } from '@/features/sources/sourceTypes';

const GITHUB_HOST = /^(?:www\.)?github\.com$/i;
const REPO_LANDING_SECTIONS = new Set(['pulls', 'branches', 'commits']);

export function githubUrlRoute(href: string): string | null {
  const url = parseUrl(href);
  if (url === null || !GITHUB_HOST.test(url.hostname)) return null;
  const [owner, repo, ...rest] = decodeSegments(url.pathname);
  if (owner === undefined || repo === undefined) return null;
  return repoSubpathRoute(owner, repo, rest);
}

export function repoSubpathRoute(owner: string, repo: string, rest: string[]): string | null {
  if (!LOGIN_PATTERN.test(owner) || !REPO_NAME_PATTERN.test(repo)) return null;
  const [section, ...tail] = rest;
  if (section === undefined) return repoRoute(owner, repo);
  if (section === 'pull') return pullSectionRoute(owner, repo, tail[0]);
  if (section === 'tree' || section === 'blob') return refSectionRoute(owner, repo, tail[0]);
  return REPO_LANDING_SECTIONS.has(section) ? repoRoute(owner, repo) : null;
}

function pullSectionRoute(owner: string, repo: string, number: string | undefined): string | null {
  if (number === undefined || !PULL_NUMBER_PATTERN.test(number)) return null;
  return pullRoute(owner, repo, Number(number));
}

function refSectionRoute(owner: string, repo: string, ref: string | undefined): string | null {
  if (ref === undefined || ref === 'HEAD' || !BRANCH_NAME_PATTERN.test(ref)) return null;
  return branchRoute(owner, repo, ref);
}

function decodeSegments(pathname: string): string[] {
  return pathname.split('/').filter(Boolean).map(decodeSegment);
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function parseUrl(href: string): URL | null {
  try {
    return new URL(href);
  } catch {
    return null;
  }
}
