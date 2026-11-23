'use client';

import { ChangeCounts } from './ChangeCounts';
import { useDiffSort } from './diffSortStore';
import { TrashIcon } from './diffToolbarIcons';
import { FileTreeRow } from './FileTreeRow';
import { FolderGroupedRows } from './FolderGroupedRows';
import type { ChangedFile } from './pullRequests';
import { HoverCardTrigger } from '@/features/surface-ui/HoverCard';
import { useKeptInView } from '@/features/surface-ui/useKeptInView';

const DELETE_SLOT =
  'absolute right-0.5 top-1/2 -translate-y-1/2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100';
const DELETE_BUTTON = 'flex items-center rounded bg-btn px-1 py-[1px] text-ink-dim hover:bg-btn-hover hover:text-error-ink';

interface RowProps {
  selected: string | null;
  onSelect: (filename: string) => void;
  onDelete: ((filename: string) => void) | null;
}

export function ChangedFileTree({ files, ...row }: RowProps & { files: ChangedFile[] }) {
  const grouped = useDiffSort() === 'folder';
  if (grouped) return <GroupedRows files={files} {...row} />;
  return <>{files.map((file) => <ChangedFileRow key={file.filename} file={file} indented={false} {...row} />)}</>;
}

function GroupedRows({ files, ...row }: RowProps & { files: ChangedFile[] }) {
  return (
    <FolderGroupedRows items={files} pathOf={(file) => file.filename}>
      {(file, indented) => <ChangedFileRow key={file.filename} file={file} indented={indented} {...row} />}
    </FolderGroupedRows>
  );
}

function ChangedFileRow({ file, indented, selected, onSelect, onDelete }: RowProps & { file: ChangedFile; indented: boolean }) {
  const current = file.filename === selected;
  const rowRef = useKeptInView<HTMLButtonElement>(current);
  return (
    <FileTreeRow
      path={file.filename}
      selected={current}
      rowRef={rowRef}
      onSelect={() => onSelect(file.filename)}
      indented={indented}
      action={deleteIconFor(file, onDelete)}
    >
      <ChangeCounts additions={file.additions} deletions={file.deletions} />
    </FileTreeRow>
  );
}

function deleteIconFor(file: ChangedFile, onDelete: ((filename: string) => void) | null) {
  if (onDelete === null || file.status === 'removed') return null;
  return (
    <HoverCardTrigger label={`Delete ${file.filename}`} className={DELETE_SLOT} focusable={false} tooltipStyle>
      <button type="button" aria-label={`Delete ${file.filename}`} onClick={() => onDelete(file.filename)} className={DELETE_BUTTON}>
        <TrashIcon />
      </button>
    </HoverCardTrigger>
  );
}
