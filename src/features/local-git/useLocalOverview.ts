'use client';

import type { LocalOverview } from './localOverview';
import { localOverviewPath } from './localRoutes';
import { useGithubToken, useStoreReady } from '@/features/sources/sourceStore';
import { useCachedJson, type CachedJson } from '@/features/sources/useCachedJson';
import { usePollWhileVisible } from '@/features/sources/usePollWhileVisible';

export function useLocalOverview(repo: string): CachedJson<LocalOverview> {
  const ready = useStoreReady();
  const state = useCachedJson<LocalOverview>(localOverviewPath(repo), useGithubToken(), ready);
  usePollWhileVisible(state.reload, ready);
  return state;
}
