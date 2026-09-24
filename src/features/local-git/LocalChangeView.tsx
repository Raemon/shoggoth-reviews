'use client';

import { useEffect } from 'react';
import { useShowingLocal } from './currentLocalStore';
import type { LocalChangeSet } from './localChange';
import { LocalChangesColumn } from './LocalChangesColumn';
import { LOCAL_OWNER } from './localRefs';
import { commandLine, localChangePath, localChangeRoute, type LocalChangeTarget } from './localRoutes';
import { rememberRepo } from '@/features/desktop/recentRepos';
import { ReviewLoadNotice } from '@/features/pull-requests/ReviewLoadNotice';
import { ReviewWorkspace } from '@/features/pull-requests/ReviewWorkspace';
import { useStickyColumn } from '@/features/pull-requests/stickyColumns';
import { useGithubToken, useStoreReady } from '@/features/sources/sourceStore';
import { useCachedJson } from '@/features/sources/useCachedJson';
import { usePollWhileVisible } from '@/features/sources/usePollWhileVisible';

export function LocalChangeView({ target }: { target: LocalChangeTarget }) {
  const ready = useStoreReady();
  const path = localChangePath(target);
  const state = useCachedJson<LocalChangeSet>(path, useGithubToken(), ready);
  const [listSize, setListSize] = useStickyColumn('local-changes');
  const change = state.data;
  usePollWhileVisible(state.reload, ready);
  useShowingLocal(target.repo, target);
  useRememberedOnceLoaded(target.repo, change !== null);

  if (!change) return <ReviewLoadNotice label={commandLine(target)} error={state.error} reload={state.reload} />;

  return (
    <ReviewWorkspace
      owner={LOCAL_OWNER}
      repo={target.repo}
      number={null}
      subjectKey={path}
      change={change}
      baseRef={change.baseRef}
      headRef={change.headRef}
      reloadChange={state.reload}
      wholeFilesPath={path}
      listColumn={<LocalChangesColumn repo={target.repo} current={localChangeRoute(target)} size={listSize} onSize={setListSize} />}
      discussion={null}
      editableWhole={null}
    />
  );
}

function useRememberedOnceLoaded(repo: string, loaded: boolean): void {
  useEffect(() => {
    if (loaded) rememberRepo(repo);
  }, [repo, loaded]);
}
