import { githubTarget, targetRoute, type GithubTarget } from './githubUrlRoutes';
import { repoRoute } from './repoPaths';
import { longestBranchPrefix } from '@/features/pull-requests/branches';
import { branchRoute } from '@/features/pull-requests/pullPaths';

export async function githubShapedRoute(owner: string, repo: string, rest: string[]): Promise<string> {
  const target = githubTarget(owner, repo, rest);
  if (target === null) return repoRoute(owner, repo);
  return target.kind === 'ref' ? resolvedRefRoute(target) : targetRoute(target);
}

async function resolvedRefRoute({ owner, repo, segments }: GithubTarget & { kind: 'ref' }): Promise<string> {
  const branch = await longestBranchPrefix(owner, repo, segments);
  return branch === null ? repoRoute(owner, repo) : branchRoute(owner, repo, branch);
}
