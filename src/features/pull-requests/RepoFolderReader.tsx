'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DiffPanes } from './DiffPanes';
import { headingsBefore, isFileItem, type FolderHeading, type ReadingItem } from './fileTreeNodes';
import { isImagePath } from './imageFiles';
import type { ChangedFile } from './pullRequests';
import { ReviewThreadProvider } from './reviewThreadStore';
import { useFileText } from './useFileText';
import { wholeFileEntry, wholeFileSetOf } from './wholeFileEntry';
import { PaneStatusLine } from '@/features/surface-ui/PaneStatusLine';

const AT_ONCE = 80;

export function RepoFolderReader({
  owner,
  repo,
  refName,
  items,
}: {
  owner: string;
  repo: string;
  refName: string;
  items: ReadingItem[];
}) {
  const { paths, shown, read, files, headings, waiting, hold } = useFolderContents(items);

  if (paths.length === 0) return <PaneStatusLine tone="dim" className="flex-1">No files in this folder.</PaneStatusLine>;
  return (
    <ReviewThreadProvider owner={owner} repo={repo} number={null}>
      {read.map((path) => (
        <FileTextLoader key={path} owner={owner} repo={repo} refName={refName} path={path} onText={hold} />
      ))}
      {waiting > 0 ? (
        <PaneStatusLine tone="dim" className="flex-1">Loading {waiting} of {read.length} files…</PaneStatusLine>
      ) : (
        <FolderPanes owner={owner} repo={repo} refName={refName} files={files} headings={headings} />
      )}
      <FolderNotes left={paths.length - shown.length} skipped={waiting > 0 ? 0 : shown.length - files.length} />
    </ReviewThreadProvider>
  );
}

function FolderPanes({
  owner,
  repo,
  refName,
  files,
  headings,
}: {
  owner: string;
  repo: string;
  refName: string;
  files: ChangedFile[];
  headings: ReadonlyMap<string, FolderHeading[]>;
}) {
  const fileSet = useMemo(() => wholeFileSetOf(refName, files), [refName, files]);
  if (files.length === 0) return <PaneStatusLine tone="dim" className="flex-1">None of these files can be shown here.</PaneStatusLine>;
  return (
    <DiffPanes owner={owner} repo={repo} fileSet={fileSet} files={files} selected={null} headings={headings} />
  );
}

function FolderNotes({ left, skipped }: { left: number; skipped: number }) {
  return (
    <>
      {left > 0 && <PaneStatusLine tone="dim" className="shrink-0">{left} more files in this folder — open a subfolder or single file.</PaneStatusLine>}
      {skipped > 0 && <PaneStatusLine tone="dim" className="shrink-0">{skipped} files left out — too large to show, or unreadable.</PaneStatusLine>}
    </>
  );
}

function useFolderContents(items: ReadingItem[]) {
  const { texts, hold } = useHeldTexts();
  const paths = useMemo(() => items.filter(isFileItem).map((item) => item.path), [items]);
  const shown = useMemo(() => paths.slice(0, AT_ONCE), [paths]);
  const read = useMemo(() => shown.filter((path) => !isImagePath(path)), [shown]);
  const files = useMemo(() => readableFiles(shown, texts), [shown, texts]);
  const headings = useMemo(() => headingsBefore(items, new Set(files.map((file) => file.filename))), [items, files]);
  const waiting = read.filter((path) => !texts.has(path)).length;
  return { paths, shown, read, files, headings, waiting, hold };
}

function useHeldTexts() {
  const [texts, setTexts] = useState<ReadonlyMap<string, string | null>>(() => new Map());
  const hold = useCallback((path: string, text: string | null) => setTexts((held) => new Map(held).set(path, text)), []);
  return { texts, hold };
}

function FileTextLoader({
  owner,
  repo,
  refName,
  path,
  onText,
}: {
  owner: string;
  repo: string;
  refName: string;
  path: string;
  onText: (path: string, text: string | null) => void;
}) {
  const { data, error } = useFileText(owner, repo, refName, path);
  const text = data?.text ?? null;
  useEffect(() => {
    if (data || error) onText(path, text);
  }, [data, error, text, path, onText]);
  return null;
}

function readableFiles(paths: string[], texts: ReadonlyMap<string, string | null>): ChangedFile[] {
  return paths
    .filter((path) => (isImagePath(path) ? true : (texts.get(path) ?? null) !== null))
    .map((path) => wholeFileEntry(path, texts.get(path) ?? null));
}
