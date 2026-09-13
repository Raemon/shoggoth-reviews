import { githubJson } from '@/features/codebases/githubRequest';
import { defaultBranch } from '@/features/codebases/repoDirectory';
import { COMMIT_SHA_PATTERN } from '@/features/sources/sourceTypes';

export interface RepoFileSet {
  sha: string;
  files: string[];
  sizes?: Record<string, number>;
  truncated: boolean;
}

interface GithubTree {
  truncated: boolean;
  tree: { path: string; type: string; size?: number }[];
}

const API = 'https://api.github.com';

export async function listRepoFiles(owner: string, name: string, fresh = false, at?: string): Promise<RepoFileSet> {
  const ref = at ?? (await defaultBranch(owner, name, fresh));
  const sha = await resolveCommit(owner, name, ref, fresh);
  const tree = await githubJson<GithubTree>(`${API}/repos/${owner}/${name}/git/trees/${sha}?recursive=1`);
  return { sha, truncated: tree.truncated, files: blobPaths(tree), sizes: blobSizes(tree) };
}

function blobSizes(tree: GithubTree): Record<string, number> {
  return Object.fromEntries(tree.tree.filter((entry) => entry.type === 'blob').map((entry) => [entry.path, entry.size ?? 0]));
}

export async function resolveCommit(owner: string, name: string, ref: string, fresh = false): Promise<string> {
  if (COMMIT_SHA_PATTERN.test(ref)) return ref;
  const commit = await githubJson<{ sha: string }>(`${API}/repos/${owner}/${name}/commits/${encodePath(ref)}`, fresh);
  return commit.sha;
}

export function encodePath(ref: string): string {
  return ref.split('/').map(encodeURIComponent).join('/');
}

function blobPaths(tree: GithubTree): string[] {
  return tree.tree.filter((entry) => entry.type === 'blob').map((entry) => entry.path).sort();
}
