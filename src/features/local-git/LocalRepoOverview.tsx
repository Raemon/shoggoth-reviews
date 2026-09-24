'use client';

import { useEffect } from 'react';
import { useShowingLocal } from './currentLocalStore';
import { localChangeGroups } from './localChangeGroups';
import { LocalChangeList } from './LocalChangeList';
import { repoName } from './localRoutes';
import { useLocalOverview } from './useLocalOverview';
import { rememberRepo } from '@/features/desktop/recentRepos';
import { PaneStatusLine } from '@/features/surface-ui/PaneStatusLine';

export function LocalRepoOverview({ repo }: { repo: string }) {
  const overview = useLocalOverview(repo);
  const branch = overview.data?.branch;
  useShowingLocal(repo, null);
  useEffect(() => rememberRepo(repo), [repo]);
  return (
    <section className="max-w-2xl">
      <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-ink-dim">Local repository</p>
      <h1 className="text-xl text-accent">{repoName(repo)}</h1>
      <p className="mt-1 break-all text-[11px] leading-4 text-ink-dim">
        {repo}
        {branch && ` · on ${branch}`}
      </p>
      <div className="mt-4 flex max-h-[70vh] flex-col overflow-hidden rounded bg-panel">
        {overview.data ? (
          <LocalChangeList groups={localChangeGroups(overview.data)} current={null} />
        ) : (
          <PaneStatusLine tone={overview.error ? 'error' : 'dim'} onRetry={overview.error ? overview.reload : undefined}>
            {overview.error ?? 'Loading…'}
          </PaneStatusLine>
        )}
      </div>
    </section>
  );
}
