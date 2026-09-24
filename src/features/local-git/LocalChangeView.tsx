'use client';

import { useShowingLocal } from './currentLocalStore';
import type { LocalChangeSet } from './localChange';
import { LocalChangesColumn } from './LocalChangesColumn';
import { LOCAL_OWNER } from './localRefs';
import { commandLine, localChangePath, localChangeRoute, type LocalChangeTarget } from './localRoutes';
import { ReviewLoadNotice } from '@/features/pull-requests/ReviewLoadNotice';
import { ReviewWorkspace } from '@/features/pull-requests/ReviewWorkspace';
import { useStickyColumn } from '@/features/pull-requests/stickyColumns';
import { useGithubToken } from '@/features/sources/sourceStore';
import { usePolledJson } from '@/features/sources/usePolledJson';

export function LocalChangeView({ target }: { target: LocalChangeTarget }) {
  const path = localChangePath(target);
  const state = usePolledJson<LocalChangeSet>(path, useGithubToken());
  const [listSize, setListSize] = useStickyColumn('local-changes');
  const change = state.data;
  useShowingLocal(target.repo, target);

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
      aiChat={false}
    />
  );
}
