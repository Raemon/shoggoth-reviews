import { LocalGitError } from './gitRun';
import { LOCAL_COMMANDS, type LocalCommand } from './localRoutes';
import { apiRoute, requireParam } from '@/features/github-auth/apiRoute';
import { desktopMode } from '@/features/desktop/desktopMode';

const REPO_PATH_PATTERN = /^\/[^\0]{0,4095}$/;
const MAX_ARGS = 64;
const MAX_ARG_LENGTH = 1024;

// The web deployment must never read its own filesystem on a visitor's behalf.
export function localApiRoute<T>(request: Request, work: () => Promise<T>): Promise<Response> {
  return apiRoute(request, () => {
    if (!desktopMode()) throw new LocalGitError(404, 'Local repositories are only available in the desktop app');
    return work();
  });
}

export function repoParam(request: Request): string {
  return requireParam(request, 'repo', REPO_PATH_PATTERN);
}

export function commandParam(request: Request): LocalCommand {
  const command = new URL(request.url).searchParams.get('command');
  return LOCAL_COMMANDS.find((known) => known === command) ?? 'diff';
}

export function argsParam(request: Request): string[] {
  const args = new URL(request.url).searchParams.getAll('arg');
  if (args.length > MAX_ARGS || args.some((arg) => arg.length > MAX_ARG_LENGTH || arg.includes('\0'))) {
    throw new LocalGitError(400, 'Invalid git arguments');
  }
  return args;
}
