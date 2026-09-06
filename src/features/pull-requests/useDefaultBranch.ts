'use client';

import { repoSummaryPath } from './pullPaths';
import type { ChangeSummary } from './pullRequests';
import { useBranchChange } from './useBranchChange';
import type { RepoSummary } from '@/features/codebases/repoDirectory';
import { useGithubToken, useStoreReady } from '@/features/sources/sourceStore';
import { useCachedJson } from '@/features/sources/useCachedJson';

export function useDefaultBranch(owner: string, repo: string): string | null {
  const ready = useStoreReady();
  const token = useGithubToken();
  const { data } = useCachedJson<RepoSummary>(repoSummaryPath(owner, repo), token, ready);
  return data?.defaultBranch || null;
}

export function useDefaultBranchChange(owner: string, repo: string): ChangeSummary | null {
  const branch = useDefaultBranch(owner, repo);
  return useBranchChange(owner, repo, branch).data;
}
