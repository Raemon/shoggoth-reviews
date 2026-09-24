'use client';

import { localPref, usePref } from '@/features/pull-requests/localPref';

const MAX_RECENT = 12;

const recentPref = localPref<string[]>('reposcope.localRepos', [], (stored) =>
  Array.isArray(stored) ? stored.filter((repo): repo is string => typeof repo === 'string') : undefined,
);

export function useRecentRepos(): string[] {
  return usePref(recentPref);
}

export function rememberRepo(repo: string): void {
  const held = recentPref.read();
  if (held[0] !== repo) recentPref.set([repo, ...held.filter((known) => known !== repo)].slice(0, MAX_RECENT));
}

export function forgetRepo(repo: string): void {
  recentPref.set(recentPref.read().filter((known) => known !== repo));
}
