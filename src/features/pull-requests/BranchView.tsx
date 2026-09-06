'use client';

import { useEffect } from 'react';
import { RepoPullsColumn } from './PullListColumn';
import { ReviewLoadNotice } from './ReviewLoadNotice';
import { ReviewWorkspace } from './ReviewWorkspace';
import { setCurrentBranch } from './currentPullStore';
import { headCommit } from './headCommit';
import { branchFilesPath, branchSubject } from './pullPaths';
import { useBranchChange } from './useBranchChange';
import { useStickyColumn } from './stickyColumns';

export function BranchView({ owner, repo, branch }: { owner: string; repo: string; branch: string }) {
  const [listSize, setListSize] = useStickyColumn('pulls');
  const branchState = useBranchChange(owner, repo, branch);
  const change = branchState.data;

  useEffect(() => () => setCurrentBranch(null), []);
  useEffect(() => {
    setCurrentBranch(change && { owner, repo, branch, head: headCommit(change) });
  }, [change, owner, repo, branch]);

  if (!change) return <ReviewLoadNotice label={branch} error={branchState.error} reload={branchState.reload} />;

  return (
    <ReviewWorkspace
      owner={owner}
      repo={repo}
      number={null}
      subjectKey={branchSubject(owner, repo, branch)}
      change={change}
      baseRef={null}
      headRef={branch}
      reloadChange={branchState.reload}
      wholeFilesPath={branchFilesPath(owner, repo, branch)}
      listColumn={<RepoPullsColumn owner={owner} repo={repo} size={listSize} onSize={setListSize} />}
      discussion={null}
      editableWhole={null}
    />
  );
}
