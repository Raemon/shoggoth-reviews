'use client';

import { useRouter } from 'next/navigation';
import { localChangeGroups } from './localChangeGroups';
import { LocalChangeList } from './LocalChangeList';
import { useLocalOverview } from './useLocalOverview';
import { ColumnPreview } from '@/features/pull-requests/ColumnPreview';
import { useRegisterColumn } from '@/features/pull-requests/registerColumn';
import { ResizableColumn, useCollapsibleColumn, type ColumnSize } from '@/features/pull-requests/ResizableColumn';
import { PaneStatusLine } from '@/features/surface-ui/PaneStatusLine';

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
  const groups = overview.data ? localChangeGroups(overview.data) : [];
  const entries = groups.flatMap((group) => group.entries);
  const selected = entries.some((entry) => entry.route === current) ? current : null;
  useRegisterColumn('pulls', {
    ...useCollapsibleColumn('pulls', size, onSize),
    items: entries.map((entry) => entry.route),
    selected,
    onActivate: (route) => {
      if (route !== selected) router.push(route);
    },
  });
  const tokens = entries.map((entry) => ({ key: entry.route, label: entry.token, title: entry.title, accent: entry.route === selected }));
  return (
    <ResizableColumn navId="pulls" icon="⎇" title="local changes" preview={<ColumnPreview column="pulls" tokens={tokens} />} size={size} onSize={onSize}>
      {overview.data ? (
        <LocalChangeList groups={groups} current={current} />
      ) : (
        <PaneStatusLine tone={overview.error ? 'error' : 'dim'} onRetry={overview.error ? overview.reload : undefined}>
          {overview.error ?? 'Loading…'}
        </PaneStatusLine>
      )}
    </ResizableColumn>
  );
}
