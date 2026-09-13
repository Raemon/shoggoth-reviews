import { githubJson } from '@/features/codebases/githubRequest';
import { defaultBranch } from '@/features/codebases/repoDirectory';
import { encodePath } from '@/features/codebases/repoPaths';
import { COMMIT_SHA_PATTERN } from '@/features/sources/sourceTypes';

export interface RepoFileSet {
  sha: string;
  files: string[];
  truncated: boolean;
}

interface GithubTree {
  truncated: boolean;
  tree: { path: string; type: string }[];
}

const API = 'https://api.github.com';

export async function listRepoFiles(owner: string, name: string, fresh = false, at?: string): Promise<RepoFileSet> {
  const ref = at ?? (await defaultBranch(owner, name, fresh));
  const sha = await resolveCommit(owner, name, ref, fresh);
  const tree = await githubJson<GithubTree>(`${API}/repos/${owner}/${name}/git/trees/${sha}?recursive=1`);
  return { sha, truncated: tree.truncated, files: blobPaths(tree) };
}

export async function resolveCommit(owner: string, name: string, ref: string, fresh = false): Promise<string> {
  if (COMMIT_SHA_PATTERN.test(ref)) return ref;
  const commit = await githubJson<{ sha: string }>(`${API}/repos/${owner}/${name}/commits/${encodePath(ref)}`, fresh);
  return commit.sha;
}

function blobPaths(tree: GithubTree): string[] {
  return tree.tree.filter((entry) => entry.type === 'blob').map((entry) => entry.path).sort();
}
