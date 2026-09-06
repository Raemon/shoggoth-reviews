'use client';

import { branchPath } from './pullPaths';
import type { ChangeSummary } from './pullRequests';
import { useGithubToken, useStoreReady } from '@/features/sources/sourceStore';
import { useCachedJson, type CachedJson } from '@/features/sources/useCachedJson';
import { usePollWhileVisible } from '@/features/sources/usePollWhileVisible';

export function useBranchChange(owner: string, repo: string, branch: string | null): CachedJson<ChangeSummary> {
  const ready = useStoreReady();
  const token = useGithubToken();
  const path = branch === null ? null : branchPath(owner, repo, branch);
  const state = useCachedJson<ChangeSummary>(path, token, ready);
  usePollWhileVisible(state.reload, ready && branch !== null);
  return state;
}
