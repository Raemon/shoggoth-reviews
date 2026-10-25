'use client';

import { repoSummaryPath } from './pullPaths';
import type { ChangeSummary } from './pullRequests';
import { useBranchChange } from './useBranchChange';
import type { RepoSummary } from '@/features/codebases/repoDirectory';
import { useGithubToken, useStoreReady } from '@/features/sources/sourceStore';
import { useCachedJson, type CachedJson } from '@/features/sources/useCachedJson';

export function useDefaultBranch(owner: string, repo: string): string | null {
  const ready = useStoreReady();
  const token = useGithubToken();
  const { data } = useCachedJson<RepoSummary>(repoSummaryPath(owner, repo), token, ready);
  return data?.defaultBranch || null;
}

export function useDefaultBranchChange(owner: string, repo: string): CachedJson<ChangeSummary> {
  return useBranchChange(owner, repo, useDefaultBranch(owner, repo));
}
