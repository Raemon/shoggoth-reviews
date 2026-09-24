'use client';

import type { LocalOverview } from './localOverview';
import { localOverviewPath } from './localRoutes';
import { useGithubToken } from '@/features/sources/sourceStore';
import type { CachedJson } from '@/features/sources/useCachedJson';
import { usePolledJson } from '@/features/sources/usePolledJson';

export function useLocalOverview(repo: string): CachedJson<LocalOverview> {
  return usePolledJson<LocalOverview>(localOverviewPath(repo), useGithubToken());
}
