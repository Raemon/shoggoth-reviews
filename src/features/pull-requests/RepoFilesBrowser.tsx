'use client';

import { useState } from 'react';
import { ColumnPreview, type PreviewToken } from './ColumnPreview';
import { CommitDiffReader } from './CommitDiffReader';
import { useRegisterColumn } from './registerColumn';
import { rowKey } from './fileTreeNodes';
import { CommitsColumn } from './CommitsColumn';
import { WHOLE_CHANGE } from './PullCommitColumn';
import { RepoBrowseReader } from './RepoBrowseReader';
import { RepoFileList } from './RepoFileList';
import { RepoPullsColumn } from './PullListColumn';
import type { RepoFileSet } from './repoFiles';
import type { ChangeSummary } from './pullRequests';
import { useRepoFiles } from './repoFileStore';
import { ResizableColumn, useCollapsibleColumn } from './ResizableColumn';
import { useStickyColumn } from './stickyColumns';
import { useDefaultBranchChange } from './useDefaultBranch';
import { useRepoFileTree, type RepoFileTree } from './useRepoFileTree';

const BROWSE_ROW = { title: 'browse files', counts: false };
const NO_COMMITS: ChangeSummary = { additions: 0, deletions: 0, commits: [] };

export function RepoFilesBrowser({ owner, repo }: { owner: string; repo: string }) {
  const [pullSize, setPullSize] = useStickyColumn('repo-pulls');
  const [commitSize, setCommitSize] = useStickyColumn('commits');
  const [fileSize, setFileSize] = useStickyColumn('repo-files');
  const [query, setQuery] = useState('');
  const { browsed, commit, browseFile, showCommit } = useBrowseSelection();
  const repoFiles = useRepoFiles(owner, repo, true);
  const change = useDefaultBranchChange(owner, repo) ?? NO_COMMITS;
  const tree = useRepoFileTree({ repoFiles, query, selected: browsed, onSelect: browseFile });
  useRegisterColumn('files', {
    ...useCollapsibleColumn('files', fileSize, setFileSize),
    items: tree.navItems,
    selected: browsed,
    onSelect: tree.selectItem,
    onActivate: tree.activateItem,
  });
  const fileSet = repoFiles.fileSet;
  return (
    <div className="flex min-h-0 flex-1 max-md:flex-col max-md:overflow-y-auto">
      <RepoPullsColumn
        owner={owner}
        repo={repo}
        note="most recently updated first"
        size={pullSize}
        onSize={setPullSize}
      />
      <CommitsColumn
        owner={owner}
        repo={repo}
        change={change}
        selection={commit}
        onSelect={showCommit}
        size={commitSize}
        onSize={setCommitSize}
        whole={BROWSE_ROW}
      />
      <ResizableColumn
        navId="files"
        icon="▤"
        title="all files"
        tone="bg-shade"
        preview={<ColumnPreview column="files" tokens={treeTokens(tree, browsed)} />}
        size={fileSize}
        onSize={setFileSize}
      >
        <RepoFileList
          repoFiles={repoFiles}
          tree={tree}
          selected={browsed}
          onSelect={browseFile}
          query={query}
          onQuery={setQuery}
        />
      </ResizableColumn>
      <div className="flex min-w-0 flex-1 flex-col max-md:h-[80vh] max-md:flex-none">
        <BrowsePane owner={owner} repo={repo} commit={commit} fileSet={fileSet} tree={tree} item={browsed} />
      </div>
    </div>
  );
}

function useBrowseSelection() {
  const [browsed, setBrowsed] = useState<string | null>(null);
  const [commit, setCommit] = useState<string>(WHOLE_CHANGE);
  const browseFile = (item: string) => {
    setBrowsed(item);
    setCommit(WHOLE_CHANGE);
  };
  const showCommit = (sha: string) => {
    setCommit(sha);
    setBrowsed(null);
  };
  return { browsed, commit, browseFile, showCommit };
}

function BrowsePane({
  owner,
  repo,
  commit,
  fileSet,
  tree,
  item,
}: {
  owner: string;
  repo: string;
  commit: string;
  fileSet: RepoFileSet | null;
  tree: RepoFileTree;
  item: string | null;
}) {
  if (commit !== WHOLE_CHANGE) return <CommitDiffReader owner={owner} repo={repo} sha={commit} />;
  if (item === null || fileSet === null) return <p className="px-2 py-1 text-[11px] text-ink-dim">Pick a file or folder to read it here.</p>;
  return <RepoBrowseReader owner={owner} repo={repo} fileSet={fileSet} tree={tree} item={item} />;
}

const PREVIEW_CHIPS = 60;

function treeTokens(tree: RepoFileTree, selected: string | null): PreviewToken[] {
  return tree.rows.slice(0, PREVIEW_CHIPS).map((row) => ({
    key: rowKey(row),
    label: row.node.name.slice(0, 2),
    title: row.node.path,
    accent: rowKey(row) === selected,
    serif: true,
  }));
}
