'use client';

import { useRouter } from 'next/navigation';
import { localChangeGroups, type LocalChangeEntry } from './localChangeGroups';
import { LocalOverviewList } from './LocalChangeList';
import { useLocalOverview } from './useLocalOverview';
import { ColumnPreview, type PreviewToken } from '@/features/pull-requests/ColumnPreview';
import { useRegisterColumn } from '@/features/pull-requests/registerColumn';
import { ResizableColumn, useCollapsibleColumn, type ColumnSize } from '@/features/pull-requests/ResizableColumn';

export function LocalChangesColumn({
  repo,
  current,
  size,
  onSize,
}: {
  repo: string;
  current: string;
  size: ColumnSize;
  onSize: (next: ColumnSize) => void;
}) {
  const router = useRouter();
  const overview = useLocalOverview(repo);
  const entries = overview.data ? localChangeGroups(overview.data).flatMap((group) => group.entries) : [];
  const selected = entries.some((entry) => entry.route === current) ? current : null;
  useRegisterColumn('pulls', {
    ...useCollapsibleColumn('pulls', size, onSize),
    items: entries.map((entry) => entry.route),
    selected,
    onActivate: (route) => {
      if (route !== selected) router.push(route);
    },
  });
  const preview = <ColumnPreview column="pulls" tokens={entries.map((entry) => entryToken(entry, selected))} />;
  return (
    <ResizableColumn navId="pulls" icon="⎇" title="local changes" preview={preview} size={size} onSize={onSize}>
      <LocalOverviewList overview={overview} current={current} />
    </ResizableColumn>
  );
}

function entryToken(entry: LocalChangeEntry, selected: string | null): PreviewToken {
  return { key: entry.route, label: entry.token, title: entry.title, accent: entry.route === selected };
}
