import { gitLine, gitText, LocalGitError } from './gitRun';

export function commitSha(root: string, rev: string): Promise<string | null> {
  return gitLine(root, ['rev-parse', '--verify', '--quiet', `${rev}^{commit}`]);
}

export function headSha(root: string): Promise<string | null> {
  return commitSha(root, 'HEAD');
}

export function parentSha(root: string, sha: string): Promise<string | null> {
  return gitLine(root, ['rev-parse', '--verify', '--quiet', `${sha}^1`]);
}

export async function requireCommit(root: string, rev: string): Promise<string> {
  const sha = await commitSha(root, rev);
  if (sha === null) throw new LocalGitError(400, `Unknown revision: ${rev}`);
  return sha;
}

export async function mergeBase(root: string, left: string, right: string): Promise<string> {
  const [base, head] = await Promise.all([requireCommit(root, left), requireCommit(root, right)]);
  const shared = await gitLine(root, ['merge-base', base, head]);
  if (shared === null) throw new LocalGitError(400, `${left} and ${right} share no history`);
  return shared;
}

export async function orEmptyTree(root: string, sha: string | null): Promise<string> {
  return sha ?? (await gitText(root, ['hash-object', '-t', 'tree', '/dev/null'])).trim();
}
