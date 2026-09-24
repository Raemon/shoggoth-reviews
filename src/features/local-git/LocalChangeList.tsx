'use client';

import { localChangeGroups, type LocalChangeEntry, type LocalChangeGroup } from './localChangeGroups';
import type { LocalOverview } from './localOverview';
import { NavListRow } from '@/features/pull-requests/NavListRow';
import type { CachedJson } from '@/features/sources/useCachedJson';
import { PaneStatusLine } from '@/features/surface-ui/PaneStatusLine';
import { RelativeTime } from '@/features/surface-ui/RelativeTime';

const NOTE = 'px-2 py-1 text-[11px] leading-4 text-ink-dim';
const META = 'shrink-0 text-[9px] text-ink-dim';

export function LocalOverviewList({ overview, current }: { overview: CachedJson<LocalOverview>; current: string | null }) {
  if (overview.data) return <LocalChangeList groups={localChangeGroups(overview.data)} current={current} />;
  const onRetry = overview.error ? overview.reload : undefined;
  return (
    <PaneStatusLine tone={onRetry ? 'error' : 'dim'} onRetry={onRetry}>
      {overview.error ?? 'Loading…'}
    </PaneStatusLine>
  );
}

function LocalChangeList({ groups, current }: { groups: LocalChangeGroup[]; current: string | null }) {
  return (
    <nav className="flex min-h-full flex-1 flex-col overflow-auto py-[1px]">
      {groups.map((group) => (
        <GroupRows key={group.title} group={group} current={current} />
      ))}
    </nav>
  );
}

function GroupRows({ group, current }: { group: LocalChangeGroup; current: string | null }) {
  return (
    <section>
      <h2 className="px-2 pb-0.5 pt-2 text-[9px] uppercase tracking-[0.18em] text-ink-dim">{group.title}</h2>
      {group.entries.length === 0 && group.empty && <p className={NOTE}>{group.empty}</p>}
      {group.entries.map((entry) => (
        <EntryRow key={entry.route} entry={entry} current={entry.route === current} />
      ))}
    </section>
  );
}

function EntryRow({ entry, current }: { entry: LocalChangeEntry; current: boolean }) {
  return (
    <NavListRow route={entry.route} href={entry.route} current={current} dimmed={entry.quiet}>
      <span className="min-w-0 flex-1 truncate">{entry.title}</span>
      <span className={META}>{entry.detail}</span>
      {entry.date !== null && <RelativeTime iso={entry.date} className={META} />}
    </NavListRow>
  );
}
