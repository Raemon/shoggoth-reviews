'use client';

import { RepoFileList } from './RepoFileList';
import type { RepoFiles } from './repoFileStore';
import type { RepoFileTree } from './useRepoFileTree';
import { SectionHeader } from './ResizableColumn';

export function AllFilesSection({
  repoFiles,
  tree,
  expanded,
  onExpanded,
  selected,
  onSelect,
  query,
  onQuery,
}: {
  repoFiles: RepoFiles;
  tree: RepoFileTree;
  expanded: boolean;
  onExpanded: (next: boolean) => void;
  selected: string | null;
  onSelect: (item: string) => void;
  query: string;
  onQuery: (next: string) => void;
}) {
  return (
    <section className={`flex shrink-0 flex-col border-t border-panel-edge ${expanded ? 'h-1/2 min-h-0' : ''}`}>
      <SectionHeader
        icon="▤"
        title="all files"
        titleTone="text-ink-dim"
        chevron={expanded ? '⌄' : '⌃'}
        className="w-full bg-panel text-ink-dim hover:bg-btn-hover"
        label={`${expanded ? 'Collapse' : 'Expand'} all files`}
        expanded={expanded}
        onActivate={() => onExpanded(!expanded)}
      />
      {expanded && (
        <div className="flex min-h-0 flex-1 flex-col overflow-auto py-[1px]">
          <RepoFileList
            repoFiles={repoFiles}
            tree={tree}
            selected={selected}
            onSelect={onSelect}
            query={query}
            onQuery={onQuery}
          />
        </div>
      )}
    </section>
  );
}
