import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { canonicalArgs } from './diffArgs';
import { repositoryRoot, requireDesktop } from './localRepo';
import { localChangeRoute, localCommandOf, repoName, type LocalCommand } from './localRoutes';
import { errorMessage } from '@/features/sources/errorMessage';

interface Launch {
  dir: string;
  command: LocalCommand;
  args: string[];
}

export async function launchRoute(cwd: string | null, rawArgs: string[]): Promise<string> {
  requireDesktop();
  const launch = parseLaunch(cwd ?? homedir(), rawArgs);
  const root = await repositoryRoot(launch.dir).catch(() => null);
  if (root === null) return rawArgs.length === 0 ? '/' : homeWithError(`Not a git repository: ${launch.dir}`);
  return canonicalArgs(root, launch.dir, launch.args).then(
    (args) => localChangeRoute({ repo: root, command: launch.command, args }),
    (error: unknown) => homeWithError(`${repoName(root)}: ${errorMessage(error)}`),
  );
}

function homeWithError(error: string): string {
  return `/?${new URLSearchParams({ error })}`;
}

// `[-C <dir>] [diff|show] [git args]`; the command defaults to diff.
function parseLaunch(cwd: string, args: string[]): Launch {
  const [first, second, ...rest] = args;
  if (first === '-C' && second !== undefined) return parseLaunch(resolve(cwd, second), rest);
  const command = localCommandOf(first);
  return { dir: cwd, command: command ?? 'diff', args: command ? args.slice(1) : args };
}
