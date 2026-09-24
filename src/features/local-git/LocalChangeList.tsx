'use client';

import type { LocalChangeEntry, LocalChangeGroup } from './localChangeGroups';
import { NavListRow } from '@/features/pull-requests/NavListRow';
import { RelativeTime } from '@/features/surface-ui/RelativeTime';

const NOTE = 'px-2 py-1 text-[11px] leading-4 text-ink-dim';
const META = 'shrink-0 text-[9px] text-ink-dim';

export function LocalChangeList({ groups, current }: { groups: LocalChangeGroup[]; current: string | null }) {
  return (
    <nav className="flex min-h-full flex-1 flex-col overflow-auto py-[1px]">
      {groups.map((group) => (
        <section key={group.title}>
          <h2 className="px-2 pb-0.5 pt-2 text-[9px] uppercase tracking-[0.18em] text-ink-dim">{group.title}</h2>
          {group.entries.length === 0 && group.empty !== '' && <p className={NOTE}>{group.empty}</p>}
          {group.entries.map((entry) => (
            <EntryRow key={entry.route} entry={entry} current={entry.route === current} />
          ))}
        </section>
      ))}
    </nav>
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
