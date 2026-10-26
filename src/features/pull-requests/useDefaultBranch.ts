'use client';

import { repoSummaryPath } from './pullPaths';
import type { ChangeSummary } from './pullRequests';
import { useBranchChange } from './useBranchChange';
import type { RepoSummary } from '@/features/codebases/repoDirectory';
import { useGithubToken, useStoreReady } from '@/features/sources/sourceStore';
import { useCachedJson, type CachedJson } from '@/features/sources/useCachedJson';

export function useRepoSummary(owner: string, repo: string): RepoSummary | null {
  const ready = useStoreReady();
  const token = useGithubToken();
  return useCachedJson<RepoSummary>(repoSummaryPath(owner, repo), token, ready).data;
}

export function useDefaultBranch(owner: string, repo: string): string | null {
  return useRepoSummary(owner, repo)?.defaultBranch || null;
}

export function useDefaultBranchChange(owner: string, repo: string): CachedJson<ChangeSummary> {
  return useBranchChange(owner, repo, useDefaultBranch(owner, repo));
}
