'use client';

import { ChangedFileTree } from './ChangedFileTree';
import { showsFileFilter } from './changedFileFilter';
import type { PreviewToken } from './ColumnPreview';
import { baseName } from './fileTree';
import type { ChangedFile } from './pullRequests';
import { FilterRow } from '@/features/surface-ui/FilterRow';
import { PaneStatusLine } from '@/features/surface-ui/PaneStatusLine';

export function PullFilesColumn({
  files,
  total,
  fileError,
  path,
  query,
  onQuery,
  onSelect,
  onDelete,
}: {
  files: ChangedFile[] | null;
  total: number;
  fileError: string | null;
  path: string | null;
  query: string;
  onQuery: (next: string) => void;
  onSelect: (filename: string) => void;
  onDelete: ((filename: string) => void) | null;
}) {
  if (files === null) return <PaneStatusLine tone={fileError ? 'error' : 'dim'}>{fileError ?? 'Loading…'}</PaneStatusLine>;
  if (total === 0) return <PaneStatusLine tone="dim">No files changed.</PaneStatusLine>;
  const rows = <ChangedFileRows files={files} path={path} onSelect={onSelect} onDelete={onDelete} />;
  if (!showsFileFilter(total, query)) return rows;
  return (
    <div className="flex flex-col">
      <FilterRow value={query} onChange={onQuery} label="Filter changed files" />
      {rows}
    </div>
  );
}

function ChangedFileRows({
  files,
  path,
  onSelect,
  onDelete,
}: {
  files: ChangedFile[];
  path: string | null;
  onSelect: (filename: string) => void;
  onDelete: ((filename: string) => void) | null;
}) {
  if (files.length === 0) return <PaneStatusLine tone="dim">No matching files.</PaneStatusLine>;
  return <ChangedFileTree files={files} selected={path} onSelect={onSelect} onDelete={onDelete} />;
}

export function fileTokens(files: ChangedFile[], selected: string | null): PreviewToken[] {
  return files.map((file) => ({
    key: file.filename,
    label: baseName(file.filename).slice(0, 2),
    title: file.filename,
    accent: file.filename === selected,
    serif: true,
  }));
}
