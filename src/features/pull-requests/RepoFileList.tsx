'use client';

import { RepoFileTreeRows } from './RepoFileTreeRows';
import type { RepoFiles } from './repoFileStore';
import type { RepoFileTree } from './useRepoFileTree';
import { FilterRow } from '@/features/surface-ui/FilterRow';

const NOTE = 'px-1.5 py-[1px] text-[11px] leading-4';

export function RepoFileList({
  repoFiles,
  tree,
  selected,
  onSelect,
  query,
  onQuery,
}: {
  repoFiles: RepoFiles;
  tree: RepoFileTree;
  selected: string | null;
  onSelect: (item: string) => void;
  query: string;
  onQuery: (next: string) => void;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <FilterRow value={query} onChange={onQuery} label="Filter files" />
      <FileRows repoFiles={repoFiles} tree={tree} selected={selected} onSelect={onSelect} />
      <ExpandAllSpace onActivate={tree.expandAll} />
    </div>
  );
}

function ExpandAllSpace({ onActivate }: { onActivate: () => void }) {
  return (
    <button
      type="button"
      onClick={onActivate}
      onKeyDown={(event) => event.key === 'Enter' && onActivate()}
      aria-label="Expand every folder"
      className="min-h-6 flex-1 cursor-default"
    />
  );
}

function FileRows({
  repoFiles,
  tree,
  selected,
  onSelect,
}: {
  repoFiles: RepoFiles;
  tree: RepoFileTree;
  selected: string | null;
  onSelect: (item: string) => void;
}) {
  const { fileSet, error } = repoFiles;
  if (!fileSet) return <p className={`${NOTE} ${error ? 'text-error-ink' : 'text-ink-dim'}`}>{error ?? 'Loading…'}</p>;
  return (
    <>
      <RepoFileTreeRows tree={tree} selected={selected} onSelect={onSelect} />
      <ListFoot shown={tree.shown} total={tree.total} truncated={fileSet.truncated} />
    </>
  );
}

function ListFoot({ shown, total, truncated }: { shown: number; total: number; truncated: boolean }) {
  if (total === 0) return <p className={`${NOTE} text-ink-dim`}>No matching files.</p>;
  if (shown < total) return <p className={`${NOTE} text-ink-dim`}>{total - shown} more — narrow the filter.</p>;
  if (truncated) return <p className={`${NOTE} text-ink-dim`}>Listing truncated by GitHub.</p>;
  return null;
}
