'use client';

import { branchPath } from './pullPaths';
import type { ChangeSummary } from './pullRequests';
import { useGithubToken } from '@/features/sources/sourceStore';
import type { CachedJson } from '@/features/sources/useCachedJson';
import { usePolledJson } from '@/features/sources/usePolledJson';

export function useBranchChange(owner: string, repo: string, branch: string | null): CachedJson<ChangeSummary> {
  return usePolledJson<ChangeSummary>(branch === null ? null : branchPath(owner, repo, branch), useGithubToken());
}
