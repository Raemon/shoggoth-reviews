'use client';

import { ChangedFileTree } from './ChangedFileTree';
import { showsFileFilter } from './changedFileFilter';
import type { PreviewToken } from './ColumnPreview';
import { baseName } from './fileTree';
import type { ChangedFile } from './pullRequests';
import { FilterField } from '@/features/surface-ui/FilterField';
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
  return (
    <div className="flex min-h-0 flex-col">
      {showsFileFilter(total) && (
        <div className="border-b border-panel-edge px-1.5 py-[2px]">
          <FilterField value={query} onChange={onQuery} placeholder="filter files" aria-label="Filter changed files" />
        </div>
      )}
      {files.length === 0 ? (
        <PaneStatusLine tone="dim">No matching files.</PaneStatusLine>
      ) : (
        <ChangedFileTree files={files} selected={path} onSelect={onSelect} onDelete={onDelete} />
      )}
    </div>
  );
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
