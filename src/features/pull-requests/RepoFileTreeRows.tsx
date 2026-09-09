'use client';

import { FileTreeRow } from './FileTreeRow';
import { browseKey, folderKey, ROOT_FOLDER, ROOT_ITEM, type TreeRow } from './fileTreeNodes';
import { FolderTreeRow, RootTreeRow } from './FolderTreeRow';
import { LineCount } from './LineCount';
import type { RepoFileTree } from './useRepoFileTree';

const STEP = 10;
const BASE = 6;

export function RepoFileTreeRows({
  tree,
  selected,
  onSelect,
}: {
  tree: RepoFileTree;
  selected: string | null;
  onSelect: (item: string) => void;
}) {
  return (
    <>
      {tree.rows.length > 0 && (
        <RootTreeRow
          indent={indentOf(0)}
          selected={selected === ROOT_ITEM}
          onActivate={() => tree.activateItem(ROOT_ITEM)}
        >
          <LineCount lines={tree.lines.get(ROOT_FOLDER)} />
        </RootTreeRow>
      )}
      {tree.rows.map((row) => (
        <NodeRow key={row.node.path} row={row} tree={tree} selected={selected} onSelect={onSelect} />
      ))}
    </>
  );
}

function NodeRow({
  row: { node, depth },
  tree,
  selected,
  onSelect,
}: {
  row: TreeRow;
  tree: RepoFileTree;
  selected: string | null;
  onSelect: (item: string) => void;
}) {
  if (node.kind === 'folder')
    return (
      <FolderTreeRow
        path={node.path}
        name={node.name}
        indent={indentOf(depth)}
        open={tree.isOpen(node.path)}
        selected={folderKey(node.path) === selected}
        onActivate={() => tree.activateItem(folderKey(node.path))}
      >
        <LineCount lines={tree.lines.get(node.path)} />
      </FolderTreeRow>
    );
  return (
    <FileTreeRow
      path={node.path}
      navKey={browseKey(node.path)}
      selected={browseKey(node.path) === selected}
      onSelect={() => onSelect(browseKey(node.path))}
      indent={indentOf(depth) + STEP}
    >
      <LineCount lines={tree.lines.get(node.path)} />
    </FileTreeRow>
  );
}

function indentOf(depth: number): number {
  return BASE + depth * STEP;
}
