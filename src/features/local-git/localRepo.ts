import { isAbsolute } from 'node:path';
import { gitLine, LocalGitError } from './gitRun';
import { desktopMode } from '@/features/desktop/desktopMode';

const roots = new Map<string, string>();

// Defense in depth: every local read starts here, whichever route reached it.
export async function repositoryRoot(path: string): Promise<string> {
  requireDesktop();
  const known = roots.get(path) ?? (await findRoot(path));
  roots.set(path, known);
  return known;
}

export function requireDesktop(): void {
  if (!desktopMode()) throw new LocalGitError(404, 'Local repositories are only available in the desktop app');
}

async function findRoot(path: string): Promise<string> {
  if (!isAbsolute(path)) throw new LocalGitError(400, `Not an absolute path: ${path}`);
  const root = await gitLine(path, ['rev-parse', '--show-toplevel']);
  if (root === null) throw new LocalGitError(404, `Not a git repository: ${path}`);
  return root;
}
