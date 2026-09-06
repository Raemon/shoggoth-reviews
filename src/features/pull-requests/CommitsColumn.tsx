'use client';

import { ColumnPreview } from './ColumnPreview';
import { PullCommitColumn, commitItems, commitTokens } from './PullCommitColumn';
import type { ChangeSummary } from './pullRequests';
import { useRegisterColumn } from './registerColumn';
import { ResizableColumn, useCollapsibleColumn, type ColumnSize } from './ResizableColumn';
import { plural } from '@/features/surface-ui/plural';

export function CommitsColumn({
  owner,
  repo,
  change,
  selection,
  onSelect,
  size,
  onSize,
  whole,
}: {
  owner: string;
  repo: string;
  change: ChangeSummary;
  selection: string;
  onSelect: (selection: string) => void;
  size: ColumnSize;
  onSize: (next: ColumnSize) => void;
  whole?: { title: string; counts: boolean };
}) {
  useRegisterColumn('commits', {
    ...useCollapsibleColumn('commits', size, onSize),
    items: commitItems(change),
    selected: selection,
    onSelect,
  });
  return (
    <ResizableColumn
      navId="commits"
      icon="◆"
      title="commits"
      note={plural(change.commits.length, 'commit')}
      preview={<ColumnPreview column="commits" tokens={commitTokens(change, selection)} />}
      size={size}
      onSize={onSize}
    >
      <PullCommitColumn owner={owner} repo={repo} change={change} selection={selection} onSelect={onSelect} whole={whole} />
    </ResizableColumn>
  );
}
