import { LocalGitError } from './gitRun';
import { LOCAL_REF_PATTERN } from './localRefs';
import { requireDesktop } from './localRepo';
import { localCommandOf, type LocalCommand } from './localRoutes';
import { apiRoute, requireParam } from '@/features/github-auth/apiRoute';

const REPO_PATH_PATTERN = /^\/[^\0]{0,4095}$/;
const MAX_ARGS = 64;
const MAX_ARG_LENGTH = 1024;

export function localApiRoute<T>(request: Request, work: () => Promise<T>): Promise<Response> {
  return apiRoute(request, () => {
    requireDesktop();
    return work();
  });
}

export function repoParam(request: Request): string {
  return requireParam(request, 'repo', REPO_PATH_PATTERN);
}

export function refParam(request: Request): string {
  return requireParam(request, 'ref', LOCAL_REF_PATTERN);
}

export function commandParam(request: Request): LocalCommand {
  return localCommandOf(new URL(request.url).searchParams.get('command')) ?? 'diff';
}

export function argsParam(request: Request): string[] {
  const args = new URL(request.url).searchParams.getAll('arg');
  if (args.length > MAX_ARGS || !args.every(isValidArg)) throw new LocalGitError(400, 'Invalid git arguments');
  return args;
}

function isValidArg(arg: string): boolean {
  return arg.length <= MAX_ARG_LENGTH && !arg.includes('\0');
}
