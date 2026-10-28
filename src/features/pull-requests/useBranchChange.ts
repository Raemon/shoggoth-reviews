'use client';

import type { BranchChange } from './branches';
import { branchPath } from './pullPaths';
import { useGithubToken } from '@/features/sources/sourceStore';
import type { CachedJson } from '@/features/sources/useCachedJson';
import { usePolledJson } from '@/features/sources/usePolledJson';

export function useBranchChange(owner: string, repo: string, branch: string | null): CachedJson<BranchChange> {
  return usePolledJson<BranchChange>(branch === null ? null : branchPath(owner, repo, branch), useGithubToken());
}
