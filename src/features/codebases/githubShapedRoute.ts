import { repoSubpathRoute } from './githubUrlRoutes';
import { repoRoute } from './repoPaths';
import { longestBranchPrefix } from '@/features/pull-requests/branches';
import { branchRoute } from '@/features/pull-requests/pullPaths';

export async function githubShapedRoute(owner: string, repo: string, rest: string[]): Promise<string> {
  const [section, ...tail] = rest;
  if (section === 'tree' || section === 'blob') return branchPrefixRoute(owner, repo, tail);
  return repoSubpathRoute(owner, repo, rest) ?? repoRoute(owner, repo);
}

async function branchPrefixRoute(owner: string, repo: string, tail: string[]): Promise<string> {
  const branch = await knownBranchPrefix(owner, repo, tail);
  return branch === null ? repoRoute(owner, repo) : branchRoute(owner, repo, branch);
}

async function knownBranchPrefix(owner: string, repo: string, tail: string[]): Promise<string | null> {
  try {
    return await longestBranchPrefix(owner, repo, tail);
  } catch {
    return null;
  }
}
