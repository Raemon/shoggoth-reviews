'use client';

import type { ReactNode } from 'react';
import { useColumnNav } from './columnNav';
import { fileKindColor, splitExtension } from './fileKind';
import { baseName, folderOf } from './fileTree';
import { HoverCardTrigger } from '@/features/surface-ui/HoverCard';
import { rowShowsAccent, rowStateClass } from '@/features/surface-ui/rowState';
import { SelectableRow } from '@/features/surface-ui/SelectableRow';

const ROW = 'flex w-full items-baseline gap-1.5 py-[1px] pr-1.5 text-left text-[11px] leading-4';

export function FileTreeRow({
  path,
  navKey = path,
  selected,
  onSelect,
  indented = false,
  indent,
  folderPrefix,
  action = null,
  children,
}: {
  path: string;
  navKey?: string;
  selected: boolean;
  onSelect: () => void;
  indented?: boolean;
  indent?: number;
  folderPrefix?: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  const row = useColumnNav('files').row(navKey, selected);
  const inset = insetOf(indented, indent);
  const button = (
    <SelectableRow
      {...row.props}
      onActivate={onSelect}
      style={inset.style}
      className={`${ROW} ${inset.className} ${action === null ? rowStateClass(row.state) : ''}`}
    >
      <HoverCardTrigger label={path} className="min-w-0 flex-1" focusable={false} tooltipStyle>
        <span className="min-w-0 flex-1 truncate filename-text">
          {inset.showsParent && <ParentFolder path={path} />}
          {folderPrefix && <span className="text-ink-dim">{folderPrefix}</span>}
          <FileName path={path} tinted={!rowShowsAccent(row.state)} />
        </span>
      </HoverCardTrigger>
      {children}
    </SelectableRow>
  );
  if (action === null) return button;
  return (
    <div className={`group relative ${rowStateClass(row.state)}`}>
      {button}
      {action}
    </div>
  );
}

function insetOf(indented: boolean, indent: number | undefined) {
  if (indent !== undefined) return { className: '', style: { paddingLeft: indent }, showsParent: false };
  return { className: indented ? 'pl-4' : 'pl-1.5', style: undefined, showsParent: !indented };
}

function ParentFolder({ path }: { path: string }) {
  const parent = baseName(folderOf(path));
  if (!parent) return null;
  return <span className="text-ink-dim opacity-50">{parent}/</span>;
}

function FileName({ path, tinted }: { path: string; tinted: boolean }) {
  const [stem, extension] = splitExtension(baseName(path));
  const color = tinted ? fileKindColor(path) : undefined;
  return (
    <>
      {stem}
      <span style={color ? { color } : undefined}>{extension}</span>
    </>
  );
}
