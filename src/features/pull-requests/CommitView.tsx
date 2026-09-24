'use client';

import { useMemo, useRef, useState, type RefObject } from 'react';
import { CommitHeader } from './CommitHeader';
import { ColumnPreview } from './ColumnPreview';
import { DiffPanes, type DiffPanesHandle } from './DiffPanes';
import { filterChangedFiles } from './changedFileFilter';
import { NO_COMMENTS, sortChangedFiles } from './diffSort';
import { useDiffSort } from './diffSortStore';
import { PullFilesColumn, fileTokens } from './PullFilesColumn';
import { shortSha } from './pullPaths';
import type { ChangedFile, CommitDetail } from './pullRequests';
import { ResizableColumn, useCollapsibleColumn, type ColumnSize } from './ResizableColumn';
import { ReviewLoadNotice } from './ReviewLoadNotice';
import { ReviewThreadProvider } from './reviewThreadStore';
import { useRegisterColumn } from './registerColumn';
import { useStickyColumn } from './stickyColumns';
import { useCommitDetail } from './useCommitDetail';

export function CommitView({ owner, repo, sha }: { owner: string; repo: string; sha: string }) {
  const { data: commit, error, reload } = useCommitDetail(owner, repo, sha);
  if (!commit) return <ReviewLoadNotice label={shortSha(sha)} error={error} reload={reload} />;
  return (
    <ReviewThreadProvider owner={owner} repo={repo} number={null}>
      <div className="flex h-full min-h-0 flex-col">
        <CommitHeader owner={owner} repo={repo} commit={commit} />
        <CommitFiles owner={owner} repo={repo} commit={commit} />
      </div>
    </ReviewThreadProvider>
  );
}

function CommitFiles({ owner, repo, commit }: { owner: string; repo: string; commit: CommitDetail }) {
  const [fileSize, setFileSize] = useStickyColumn('files');
  const [query, setQuery] = useState('');
  const [path, setPath] = useState<string | null>(null);
  const diffPanes = useRef<DiffPanesHandle>(null);
  const sort = useDiffSort();
  const files = useMemo(() => sortChangedFiles(commit.files, sort, NO_COMMENTS), [commit.files, sort]);
  const shownFiles = useMemo(() => filterChangedFiles(files, query), [files, query]);
  const reveal = (filename: string) => {
    setPath(filename);
    diffPanes.current?.scrollToFile(filename);
  };
  useCommitColumns({ files, shownFiles, path, reveal, fileSize, setFileSize, diffPanes });
  return (
    <div className="flex min-h-0 flex-1 max-md:flex-col max-md:overflow-y-auto">
      <ResizableColumn
        navId="files"
        icon="▤"
        title="files"
        tone="bg-shade"
        preview={<ColumnPreview column="files" tokens={fileTokens(shownFiles, path)} />}
        size={fileSize}
        onSize={setFileSize}
      >
        <PullFilesColumn
          files={shownFiles}
          total={files.length}
          fileError={null}
          path={path}
          query={query}
          onQuery={setQuery}
          onSelect={reveal}
          onDelete={null}
        />
      </ResizableColumn>
      <div className="flex min-w-0 flex-1 flex-col max-md:h-[80vh] max-md:flex-none">
        <DiffPanes ref={diffPanes} owner={owner} repo={repo} fileSet={commit} files={files} selected={path} />
      </div>
    </div>
  );
}

function useCommitColumns({
  files,
  shownFiles,
  path,
  reveal,
  fileSize,
  setFileSize,
  diffPanes,
}: {
  files: ChangedFile[];
  shownFiles: ChangedFile[];
  path: string | null;
  reveal: (filename: string) => void;
  fileSize: ColumnSize;
  setFileSize: (next: ColumnSize) => void;
  diffPanes: RefObject<DiffPanesHandle | null>;
}) {
  const filenames = (list: ChangedFile[]) => list.map((file) => file.filename);
  useRegisterColumn('files', {
    ...useCollapsibleColumn('files', fileSize, setFileSize),
    items: filenames(shownFiles),
    selected: path,
    onSelect: reveal,
    onActivate: reveal,
  });
  useRegisterColumn('diff', {
    items: filenames(files),
    selected: path,
    open: true,
    collapsible: false,
    onSelect: reveal,
    onActivate: (filename) => diffPanes.current?.toggleFile(filename),
  });
}
