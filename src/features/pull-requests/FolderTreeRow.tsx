'use client';

import type { ReactNode } from 'react';
import { useColumnNav } from './columnNav';
import { folderKey, ROOT_ITEM } from './fileTreeNodes';
import { HoverCardTrigger } from '@/features/surface-ui/HoverCard';
import { rowStateClass } from '@/features/surface-ui/rowState';
import { SelectableRow } from '@/features/surface-ui/SelectableRow';

const ROW = 'flex w-full items-baseline gap-1 py-[1px] pr-1.5 text-left text-[11px] leading-4';

export function FolderTreeRow({
  path,
  name,
  indent,
  open,
  selected,
  onActivate,
  children,
}: {
  path: string;
  name: string;
  indent: number;
  open: boolean;
  selected: boolean;
  onActivate: () => void;
  children?: ReactNode;
}) {
  const row = useColumnNav('files').row(folderKey(path), selected);
  return (
    <SelectableRow
      {...row.props}
      onActivate={onActivate}
      expanded={open}
      label={`${open ? 'Collapse' : 'Expand'} ${path}`}
      style={{ paddingLeft: indent }}
      className={`${ROW} ${rowStateClass(row.state)}`}
    >
      <span className="w-2 shrink-0 text-ink-dim">{open ? '▾' : '▸'}</span>
      <HoverCardTrigger label={path} className="min-w-0 flex-1" focusable={false} tooltipStyle>
        <span className="min-w-0 flex-1 truncate text-ink-dim">{name}/</span>
      </HoverCardTrigger>
      {children}
    </SelectableRow>
  );
}

export function RootTreeRow({
  indent,
  selected,
  onActivate,
  children,
}: {
  indent: number;
  selected: boolean;
  onActivate: () => void;
  children?: ReactNode;
}) {
  const row = useColumnNav('files').row(ROOT_ITEM, selected);
  return (
    <SelectableRow
      {...row.props}
      onActivate={onActivate}
      label="Read the whole repository"
      style={{ paddingLeft: indent }}
      className={`${ROW} ${rowStateClass(row.state)}`}
    >
      <span aria-hidden className="w-2 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-ink-dim">/</span>
      {children}
    </SelectableRow>
  );
}
