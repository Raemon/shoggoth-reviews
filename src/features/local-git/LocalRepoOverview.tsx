'use client';

import { useShowingLocal } from './currentLocalStore';
import { LocalOverviewList } from './LocalChangeList';
import { repoName } from './localRoutes';
import { useLocalOverview } from './useLocalOverview';
import { PageHeading } from '@/features/sources/PageHeading';

export function LocalRepoOverview({ repo }: { repo: string }) {
  const overview = useLocalOverview(repo);
  const branch = overview.data?.branch;
  useShowingLocal(repo, null);
  return (
    <section className="max-w-2xl">
      <PageHeading eyebrow="Local repository" title={repoName(repo)} />
      <p className="mt-1 break-all text-[11px] leading-4 text-ink-dim">
        {repo}
        {branch && ` · on ${branch}`}
      </p>
      <div className="mt-4 flex max-h-[70vh] flex-col overflow-hidden rounded bg-panel">
        <LocalOverviewList overview={overview} current={null} />
      </div>
    </section>
  );
}
