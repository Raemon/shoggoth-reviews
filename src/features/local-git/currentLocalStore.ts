'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type { LocalChangeTarget } from './localRoutes';
import { rememberRepo } from '@/features/desktop/recentRepos';
import { subjectStore } from '@/features/pull-requests/currentPullStore';

export interface CurrentLocal {
  repo: string;
  target: LocalChangeTarget | null;
}

const locals = subjectStore<CurrentLocal>();
const nothingHeld = () => null;

export function useCurrentLocal(): CurrentLocal | null {
  return useSyncExternalStore(locals.subscribe, locals.read, nothingHeld);
}

export function useShowingLocal(repo: string, target: LocalChangeTarget | null): void {
  useEffect(() => {
    rememberRepo(repo);
    locals.set({ repo, target });
    return () => locals.set(null);
  }, [repo, target]);
}
