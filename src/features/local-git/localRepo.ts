import { isAbsolute } from 'node:path';
import { gitText, LocalGitError } from './gitRun';

const roots = new Map<string, string>();

export async function repositoryRoot(path: string): Promise<string> {
  const known = roots.get(path);
  if (known) return known;
  const root = await findRoot(path);
  roots.set(path, root);
  return root;
}

async function findRoot(path: string): Promise<string> {
  if (!isAbsolute(path)) throw new LocalGitError(400, `Not an absolute path: ${path}`);
  try {
    return (await gitText(path, ['rev-parse', '--show-toplevel'])).trim();
  } catch {
    throw new LocalGitError(404, `Not a git repository: ${path}`);
  }
}
