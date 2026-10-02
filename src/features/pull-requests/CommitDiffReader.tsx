'use client';

import { DiffPanes } from './DiffPanes';
import { NO_COMMENTS, sortChangedFiles } from './diffSort';
import { useDiffSort } from './diffSortStore';
import { useCommitDetail } from './useCommitDetail';
import { ReviewThreadProvider } from './reviewThreadStore';
import { PaneStatusLine } from '@/features/surface-ui/PaneStatusLine';

export function CommitDiffReader({ owner, repo, sha }: { owner: string; repo: string; sha: string }) {
  const sort = useDiffSort();
  const { data, error, reload } = useCommitDetail(owner, repo, sha);
  if (error !== null) return <PaneStatusLine tone="error" onRetry={reload} className="flex-1">{error}</PaneStatusLine>;
  return (
    <ReviewThreadProvider owner={owner} repo={repo} number={null}>
      <DiffPanes owner={owner} repo={repo} fileSet={data} files={sortChangedFiles(data?.files ?? [], sort, NO_COMMENTS)} selected={null} />
    </ReviewThreadProvider>
  );
}
