import { repoRoute } from '@/features/codebases/repoPaths';

export type PullState = 'open' | 'closed' | 'all';

export function pullPath(owner: string, repo: string, number: number): string {
  return `/api/github/pull?${repoParams(owner, repo)}&number=${number}`;
}

export function pullFilesPath(owner: string, repo: string, number: number): string {
  return `/api/github/pull-files?${repoParams(owner, repo)}&number=${number}`;
}

export function commitFilesPath(owner: string, repo: string, sha: string): string {
  return `/api/github/commit?${repoParams(owner, repo)}&sha=${encodeURIComponent(sha)}`;
}

export function deleteFilePath(owner: string, repo: string, number: number): string {
  return `/api/github/delete-file?${repoParams(owner, repo)}&number=${number}`;
}

export function pullCommentsPath(owner: string, repo: string, number: number): string {
  return `/api/github/pull-comments?${repoParams(owner, repo)}&number=${number}`;
}

export function pullThreadsPath(owner: string, repo: string, number: number): string {
  return `/api/github/pull-threads?${repoParams(owner, repo)}&number=${number}`;
}

export function reviewReplyPath(owner: string, repo: string, number: number, rootId: number): string {
  return `/api/github/review-reply?${repoParams(owner, repo)}&number=${number}&comment=${rootId}`;
}

export function reviewCommentPath(owner: string, repo: string, number: number): string {
  return `/api/github/review-comment?${repoParams(owner, repo)}&number=${number}`;
}

export function reviewResolvePath(threadId: string, resolved: boolean): string {
  return `/api/github/review-resolve?thread=${encodeURIComponent(threadId)}&resolved=${resolved}`;
}

export function reviewReactionPath(nodeId: string, reacted: boolean): string {
  return `/api/github/review-reaction?comment=${encodeURIComponent(nodeId)}&reacted=${reacted}`;
}

export function repoSummaryPath(owner: string, repo: string): string {
  return `/api/github/repo?${repoParams(owner, repo)}`;
}

export function repoBranchesPath(owner: string, repo: string): string {
  return `/api/github/branches?${repoParams(owner, repo)}`;
}

export function branchOptionsPath(owner: string, repo: string): string {
  return `/api/github/branch-options?${repoParams(owner, repo)}`;
}

export function retargetPullPath(owner: string, repo: string, number: number, base: string): string {
  return `/api/github/pull-base?${repoParams(owner, repo)}&number=${number}&base=${encodeURIComponent(base)}`;
}

export function branchPath(owner: string, repo: string, branch: string): string {
  return `/api/github/branch?${repoParams(owner, repo)}&branch=${encodeURIComponent(branch)}`;
}

export function branchFilesPath(owner: string, repo: string, branch: string): string {
  return `/api/github/branch-files?${repoParams(owner, repo)}&branch=${encodeURIComponent(branch)}`;
}

export function repoFilesPath(owner: string, repo: string): string {
  return `/api/github/repo-files?${repoParams(owner, repo)}`;
}

export function repoFilesAtRefPath(owner: string, repo: string, ref: string): string {
  return `${repoFilesPath(owner, repo)}&ref=${encodeURIComponent(ref)}`;
}

export function repoLinesPath(owner: string, repo: string, ref: string): string {
  return `/api/github/repo-lines?${repoParams(owner, repo)}&ref=${encodeURIComponent(ref)}`;
}

export function fileTextPath(owner: string, repo: string, ref: string, path: string): string {
  return `/api/github/file?${repoParams(owner, repo)}&ref=${encodeURIComponent(ref)}&path=${encodeURIComponent(path)}`;
}

export function repoPullsPath(owner: string, repo: string, state: PullState = 'open'): string {
  return `/api/github/pulls?${repoParams(owner, repo)}&state=${state}`;
}

export function pullStateParam(request: Request): PullState {
  const asked = new URL(request.url).searchParams.get('state');
  return asked === 'all' || asked === 'closed' ? asked : 'open';
}

export function mergePullPath(owner: string, repo: string, number: number): string {
  return `/api/github/merge?${repoParams(owner, repo)}&number=${number}`;
}

export function closePullPath(owner: string, repo: string, number: number): string {
  return `/api/github/close?${repoParams(owner, repo)}&number=${number}`;
}

export function freshPreviewPath(owner: string, repo: string, number: number): string {
  return `/api/github/preview-branch?${repoParams(owner, repo)}&number=${number}`;
}

export function pullPreviewsPath(owner: string, repo: string, number: number): string {
  return `/api/github/pull-previews?${repoParams(owner, repo)}&number=${number}`;
}

export function pullSubject(owner: string, repo: string, number: number): string {
  return `${owner}/${repo}#${number}`;
}

export function branchSubject(owner: string, repo: string, branch: string): string {
  return `${owner}/${repo}@${branch}`;
}

export function pullUrl(owner: string, repo: string, number: number): string {
  return `https://github.com/${owner}/${repo}/pull/${number}`;
}

export function pullRoute(owner: string, repo: string, number: number): string {
  return `${repoRoute(owner, repo)}/pull/${number}`;
}

export function branchRoute(owner: string, repo: string, branch: string): string {
  return `${repoRoute(owner, repo)}/branch/${branch.split('/').map(encodeURIComponent).join('/')}`;
}

export function branchListingRoute(owner: string, repo: string, branch: { name: string; isDefault: boolean }): string {
  return branch.isDefault ? repoRoute(owner, repo) : branchRoute(owner, repo, branch.name);
}

export function allPullsRoute(owner: string, repo: string, number: number): string {
  return `${pullRoute(owner, repo, number)}?from=all`;
}

function repoParams(owner: string, repo: string): string {
  return `owner=${encodeURIComponent(owner)}&name=${encodeURIComponent(repo)}`;
}
