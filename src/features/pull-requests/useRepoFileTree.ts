'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ancestorFolders,
  buildFileTree,
  folderedPath,
  lineTotals,
  listedPaths,
  rowKey,
  ROOT_ITEM,
  treePath,
  visibleRows,
  type TreeNode,
  type TreeRow,
} from './fileTreeNodes';
import type { RepoFiles } from './repoFileStore';

export interface RepoFileTree {
  rows: TreeRow[];
  nodes: TreeNode[];
  lines: ReadonlyMap<string, number>;
  navItems: string[];
  shown: number;
  total: number;
  isOpen: (path: string) => boolean;
  toggle: (path: string) => void;
  expandAll: () => void;
  selectItem: (item: string) => void;
  activateItem: (item: string) => void;
}

export function useRepoFileTree({
  repoFiles,
  query,
  selected,
  onSelect,
}: {
  repoFiles: RepoFiles;
  query: string;
  selected: string | null;
  onSelect: (item: string) => void;
}): RepoFileTree {
  const [opened, setOpened] = useState<ReadonlySet<string> | null>(null);
  const listed = useMemo(() => listedPaths(repoFiles, query), [repoFiles, query]);
  const nodes = useMemo(() => buildFileTree(listed.shown), [listed.shown]);
  const filtering = query.trim() !== '';
  const isOpen = useCallback(
    (path: string) => filtering || opened === null || opened.has(path),
    [filtering, opened],
  );
  const rows = useMemo(() => visibleRows(nodes, isOpen), [nodes, isOpen]);
  const counts = repoFiles.lineCounts;
  const lines = useMemo(() => (counts ? lineTotals(counts) : new Map<string, number>()), [counts]);
  const everyFolder = useMemo(() => allFolders(repoFiles), [repoFiles]);
  const toggle = useCallback(
    (path: string) => setOpened((held) => withToggled(held ?? everyFolder, path)),
    [everyFolder],
  );
  const expandAll = useCallback(() => setOpened(null), []);

  useEffect(() => {
    const path = selected === null ? null : treePath(selected);
    if (path !== null) setOpened((held) => withRevealed(held, path));
  }, [selected]);

  const activateItem = useCallback(
    (item: string) => {
      const folder = folderedPath(item);
      if (folder) toggle(folder);
      onSelect(item);
    },
    [onSelect, toggle],
  );

  return {
    rows,
    nodes,
    lines,
    navItems: useMemo(() => (rows.length === 0 ? [] : [ROOT_ITEM, ...rows.map(rowKey)]), [rows]),
    shown: listed.shown.length,
    total: listed.total,
    isOpen,
    toggle,
    expandAll,
    selectItem: onSelect,
    activateItem,
  };
}

function allFolders(repoFiles: RepoFiles): ReadonlySet<string> {
  return new Set((repoFiles.fileSet?.files ?? []).flatMap(ancestorFolders));
}

function withRevealed(held: ReadonlySet<string> | null, path: string): ReadonlySet<string> | null {
  return held === null ? held : withOpened(held, ancestorFolders(path));
}

function withToggled(held: ReadonlySet<string>, path: string): ReadonlySet<string> {
  const next = new Set(held);
  if (!next.delete(path)) next.add(path);
  return next;
}

function withOpened(held: ReadonlySet<string>, folders: string[]): ReadonlySet<string> {
  if (folders.every((folder) => held.has(folder))) return held;
  return new Set([...held, ...folders]);
}
