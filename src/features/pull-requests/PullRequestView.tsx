'use client';

import { useEffect, useRef, useState } from 'react';
import { PullDiscussion } from './PullDiscussion';
import { AllPullsColumn, RepoPullsColumn } from './PullListColumn';
import { ReviewLoadNotice } from './ReviewLoadNotice';
import { ReviewWorkspace } from './ReviewWorkspace';
import { setCurrentPull } from './currentPullStore';
import { prefetchPull } from './prefetchPull';
import { pullFilesPath, pullPath, pullSubject } from './pullPaths';
import type { PullRequestCommits, PullRequestSummary } from './pullRequests';
import type { ColumnSize } from './ResizableColumn';
import { useStickyColumn } from './stickyColumns';
import { useGithubToken, useStoreReady } from '@/features/sources/sourceStore';
import { useCachedJson } from '@/features/sources/useCachedJson';
import { usePollWhileVisible } from '@/features/sources/usePollWhileVisible';

export function PullRequestView({
  owner,
  repo,
  number,
  acrossRepos = false,
}: {
  owner: string;
  repo: string;
  number: number;
  acrossRepos?: boolean;
}) {
  const ready = useStoreReady();
  const token = useGithubToken();
  const [storedListSize, setStoredListSize] = useStickyColumn(acrossRepos ? 'all-pulls' : 'pulls');
  const [listOpen, setListOpen] = useState(false);
  const listSize = { ...storedListSize, open: listOpen };
  const setListSize = (size: ColumnSize) => {
    setListOpen(size.open);
    setStoredListSize(size);
  };
  const pullState = useCachedJson<PullRequestCommits>(pullPath(owner, repo, number), token, ready);
  const pull = pullState.data;

  usePollWhileVisible(pullState.reload, ready);

  useEffect(() => {
    setListOpen(false);
  }, [owner, repo, number, acrossRepos]);

  // Without this the file list waits on the pull call before anything asks for it.
  useEffect(() => {
    if (ready) prefetchPull(owner, repo, number, token);
  }, [ready, owner, repo, number, token]);

  const latestReload = useRef(pullState.reload);
  latestReload.current = pullState.reload;

  useEffect(() => () => setCurrentPull(null), []);
  useEffect(() => {
    setCurrentPull(pull && { owner, repo, pull, reload: () => latestReload.current() });
  }, [pull, owner, repo]);

  if (!pull) return <ReviewLoadNotice label={`#${number}`} error={pullState.error} reload={pullState.reload} />;

  return (
    <ReviewWorkspace
      owner={owner}
      repo={repo}
      number={number}
      subjectKey={pullSubject(owner, repo, number)}
      change={pull}
      baseRef={pull.baseRef}
      headRef={pull.headRef}
      reloadChange={pullState.reload}
      wholeFilesPath={pullFilesPath(owner, repo, number)}
      listColumn={
        acrossRepos ? (
          <AllPullsColumn size={listSize} onSize={setListSize} />
        ) : (
          <RepoPullsColumn owner={owner} repo={repo} size={listSize} onSize={setListSize} />
        )
      }
      discussion={<PullDiscussion owner={owner} repo={repo} number={number} pull={pull.pull} body={pull.body} />}
      editableWhole={editablePull(pull.pull)}
    />
  );
}

function editablePull(pull: PullRequestSummary): PullRequestSummary | null {
  return pull.state === 'open' && !pull.merged ? pull : null;
}
