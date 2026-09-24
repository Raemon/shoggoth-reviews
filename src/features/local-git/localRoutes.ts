export const LOCAL_COMMANDS = ['diff', 'show'] as const;

export type LocalCommand = (typeof LOCAL_COMMANDS)[number];

export interface LocalChangeTarget {
  repo: string;
  command: LocalCommand;
  args: string[];
}

const FULL_SHA = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

export function localCommandOf(text: string | null | undefined): LocalCommand | undefined {
  return LOCAL_COMMANDS.find((known) => known === text);
}

export function localRepoRoute(repo: string): string {
  return `/local?${new URLSearchParams({ repo })}`;
}

export function localChangeRoute({ repo, command, args }: LocalChangeTarget): string {
  return `/${command}?${changeQuery(repo, args)}`;
}

export function localChangePath({ repo, command, args }: LocalChangeTarget): string {
  return `/api/local/change?${changeQuery(repo, args)}&command=${command}`;
}

export function localOverviewPath(repo: string): string {
  return `/api/local/overview?${new URLSearchParams({ repo })}`;
}

function changeQuery(repo: string, args: string[]): string {
  return new URLSearchParams([['repo', repo], ...args.map((arg) => ['arg', arg])]).toString();
}

export function commandLine({ command, args }: Pick<LocalChangeTarget, 'command' | 'args'>): string {
  return ['git', command, ...args.map(abbreviated)].join(' ');
}

function abbreviated(arg: string): string {
  return FULL_SHA.test(arg) ? arg.slice(0, 7) : arg;
}

export function repoName(repo: string): string {
  return repo.split(/[\\/]/).filter(Boolean).pop() ?? repo;
}
