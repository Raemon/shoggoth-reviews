import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { canonicalArgs } from './diffArgs';
import { repositoryRoot } from './localRepo';
import { LOCAL_COMMANDS, localChangeRoute, type LocalCommand } from './localRoutes';

interface Launch {
  dir: string;
  command: LocalCommand;
  args: string[];
}

export async function launchRoute(cwd: string | null, rawArgs: string[]): Promise<string> {
  const launch = parseLaunch(cwd ?? homedir(), rawArgs);
  const root = await repositoryRoot(launch.dir).catch(() => null);
  if (root === null) return rawArgs.length === 0 ? '/' : `/?${new URLSearchParams({ error: `Not a git repository: ${launch.dir}` })}`;
  const args = await canonicalArgs(root, launch.dir, launch.args).catch(() => launch.args);
  return localChangeRoute({ repo: root, command: launch.command, args });
}

// Accepts `[-C <dir>] [diff|show] [git arguments]`, defaulting to diff like a bare `git diff`.
function parseLaunch(cwd: string, args: string[]): Launch {
  const [first, second, ...rest] = args;
  if (first === '-C' && second !== undefined) return parseLaunch(resolve(cwd, second), rest);
  const command = LOCAL_COMMANDS.find((known) => known === first);
  return { dir: cwd, command: command ?? 'diff', args: command ? args.slice(1) : args };
}
