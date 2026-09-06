'use client';

import { DiffPanes } from './DiffPanes';
import { sortChangedFiles } from './diffSort';
import { useDiffSort } from './diffSortStore';
import { commitFilesPath } from './pullPaths';
import type { ChangedFileSet } from './pullRequests';
import { ReviewThreadProvider } from './reviewThreadStore';
import { PaneStatusLine } from '@/features/surface-ui/PaneStatusLine';
import { useGithubToken, useStoreReady } from '@/features/sources/sourceStore';
import { useCachedJson } from '@/features/sources/useCachedJson';

const NO_COMMENTS = new Map<string, number>();

export function CommitDiffReader({ owner, repo, sha }: { owner: string; repo: string; sha: string }) {
  const ready = useStoreReady();
  const token = useGithubToken();
  const sort = useDiffSort();
  const { data, error, reload } = useCachedJson<ChangedFileSet>(commitFilesPath(owner, repo, sha), token, ready);
  if (error !== null) return <PaneStatusLine tone="error" onRetry={reload} className="flex-1">{error}</PaneStatusLine>;
  return (
    <ReviewThreadProvider owner={owner} repo={repo} number={null}>
      <DiffPanes owner={owner} repo={repo} fileSet={data} files={sortChangedFiles(data?.files ?? [], sort, NO_COMMENTS)} selected={null} />
    </ReviewThreadProvider>
  );
}
