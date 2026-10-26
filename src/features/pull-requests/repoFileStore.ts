'use client';

import { repoFilesPath, repoLinesPath } from './pullPaths';
import type { RepoLineCounts } from './repoLineCounts';
import type { RepoFileSet } from './repoFiles';
import { useGithubToken, useStoreReady } from '@/features/sources/sourceStore';
import { useCachedJson } from '@/features/sources/useCachedJson';

export interface RepoFiles {
  fileSet: RepoFileSet | null;
  lineCounts: Record<string, number> | null;
  error: string | null;
  errorStatus: number | null;
  reload: () => Promise<RepoFileSet>;
}

export function useRepoFiles(owner: string, repo: string, wanted: boolean): RepoFiles {
  const ready = useStoreReady();
  const token = useGithubToken();
  const { data, fresh, error, errorStatus, reload } = useCachedJson<RepoFileSet>(wanted ? repoFilesPath(owner, repo) : null, token, ready);
  const countsPath = fresh && data ? repoLinesPath(owner, repo, data.sha) : null;
  const counted = useCachedJson<RepoLineCounts>(countsPath, token, ready);
  return { fileSet: data, lineCounts: counted.data?.lines ?? null, error, errorStatus, reload };
}
