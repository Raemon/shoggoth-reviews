'use client';

import { useMemo } from 'react';
import { folderedPath, folderReadingOrder, treePath } from './fileTreeNodes';
import { RepoFileReader } from './RepoFileReader';
import { RepoFolderReader } from './RepoFolderReader';
import type { RepoFileSet } from './repoFiles';
import type { RepoFileTree } from './useRepoFileTree';
import { useDebounced } from '@/features/surface-ui/useDebounced';

const SETTLE_MS = 150;

export function RepoBrowseReader({
  owner,
  repo,
  fileSet,
  tree,
  item,
}: {
  owner: string;
  repo: string;
  fileSet: RepoFileSet;
  tree: RepoFileTree;
  item: string;
}) {
  const settled = useDebounced<string | null>(item, SETTLE_MS, null);
  const folder = settled === null ? null : folderedPath(settled);
  const items = useMemo(() => (folder === null ? [] : folderReadingOrder(tree.nodes, folder)), [tree.nodes, folder]);
  if (settled === null) return null;
  if (folder !== null)
    return <RepoFolderReader key={`${fileSet.sha}:${folder}`} owner={owner} repo={repo} refName={fileSet.sha} items={items} />;
  const path = treePath(settled);
  return path === null ? null : <RepoFileReader owner={owner} repo={repo} refName={fileSet.sha} path={path} />;
}
