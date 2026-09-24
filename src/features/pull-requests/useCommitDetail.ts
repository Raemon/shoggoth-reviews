'use client';

import { commitFilesPath } from './pullPaths';
import type { CommitDetail } from './pullRequests';
import { useGithubToken, useStoreReady } from '@/features/sources/sourceStore';
import { useCachedJson } from '@/features/sources/useCachedJson';

export function useCommitDetail(owner: string, repo: string, sha: string) {
  return useCachedJson<CommitDetail>(commitFilesPath(owner, repo, sha), useGithubToken(), useStoreReady());
}
