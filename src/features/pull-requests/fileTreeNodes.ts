import { baseName, folderOf } from './fileTree';
import type { RepoFiles } from './repoFileStore';

const SHOWN_LIMIT = 400;
const FILE_PREFIX = 'file:';
const FOLDER_PREFIX = 'dir:';

export interface TreeFolder {
  kind: 'folder';
  path: string;
  name: string;
  children: TreeNode[];
}

export interface TreeFile {
  kind: 'file';
  path: string;
  name: string;
}

export type TreeNode = TreeFolder | TreeFile;

export interface TreeRow {
  node: TreeNode;
  depth: number;
}

export function browseKey(path: string): string {
  return `${FILE_PREFIX}${path}`;
}

export function folderKey(path: string): string {
  return `${FOLDER_PREFIX}${path}`;
}

export const ROOT_FOLDER = '';

export const ROOT_ITEM = folderKey(ROOT_FOLDER);

// Returns '' for the root listing, so callers must test `!== null`, not truthiness.
export function folderedPath(item: string): string | null {
  return item.startsWith(FOLDER_PREFIX) ? item.slice(FOLDER_PREFIX.length) : null;
}

export function isTreeItem(item: string): boolean {
  return item.startsWith(FILE_PREFIX) || item.startsWith(FOLDER_PREFIX);
}

export function treePath(item: string): string | null {
  return folderedPath(item) ?? filedPath(item);
}

function filedPath(item: string): string | null {
  return item.startsWith(FILE_PREFIX) ? item.slice(FILE_PREFIX.length) : null;
}

export type FolderHeading = { kind: 'folder'; path: string; depth: number };
export type ReadingItem = FolderHeading | { kind: 'file'; path: string };

export function folderReadingOrder(nodes: TreeNode[], folder: string): ReadingItem[] {
  if (folder === ROOT_FOLDER) return childReadingOrder(nodes, 0);
  const found = findFolder(nodes, folder);
  return found ? readingOrder(found, 0) : [];
}

function findFolder(nodes: TreeNode[], path: string): TreeFolder | null {
  for (const node of nodes) {
    if (node.kind !== 'folder') continue;
    if (node.path === path) return node;
    if (path.startsWith(`${node.path}/`)) return findFolder(node.children, path);
  }
  return null;
}

function readingOrder(folder: TreeFolder, depth: number): ReadingItem[] {
  return [{ kind: 'folder', path: folder.path, depth }, ...childReadingOrder(folder.children, depth + 1)];
}

function childReadingOrder(children: TreeNode[], depth: number): ReadingItem[] {
  const files = children.filter(isFileNode).map((child): ReadingItem => ({ kind: 'file', path: child.path }));
  return [...files, ...children.filter(isFolderNode).flatMap((child) => readingOrder(child, depth))];
}

function isFileNode(node: TreeNode): node is TreeFile {
  return node.kind === 'file';
}

function isFolderNode(node: TreeNode): node is TreeFolder {
  return node.kind === 'folder';
}

export function isFileItem(item: ReadingItem): item is { kind: 'file'; path: string } {
  return item.kind === 'file';
}

export function headingsBefore(items: ReadingItem[], shown: ReadonlySet<string>): ReadonlyMap<string, FolderHeading[]> {
  const populated = new Set([...shown].flatMap(ancestorFolders));
  const before = new Map<string, FolderHeading[]>();
  let pending: FolderHeading[] = [];
  for (const item of items) {
    if (!isFileItem(item)) {
      if (populated.has(item.path)) pending.push(item);
    } else if (shown.has(item.path)) {
      before.set(item.path, pending);
      pending = [];
    }
  }
  return before;
}

export function lineTotals(counts: Record<string, number>): ReadonlyMap<string, number> {
  const totals = new Map<string, number>();
  for (const [path, lines] of Object.entries(counts)) {
    totals.set(path, lines);
    for (const folder of ancestorFolders(path)) totals.set(folder, (totals.get(folder) ?? 0) + lines);
    totals.set(ROOT_FOLDER, (totals.get(ROOT_FOLDER) ?? 0) + lines);
  }
  return totals;
}

export function rowKey(row: TreeRow): string {
  return row.node.kind === 'folder' ? folderKey(row.node.path) : browseKey(row.node.path);
}

export function listedPaths(repoFiles: RepoFiles, query: string): { shown: string[]; total: number } {
  const paths = repoFiles.fileSet?.files ?? [];
  const wanted = query.trim().toLowerCase();
  if (!wanted) return { shown: paths, total: paths.length };
  const matching = paths.filter((path) => path.toLowerCase().includes(wanted));
  return { shown: matching.slice(0, SHOWN_LIMIT), total: matching.length };
}

export function buildFileTree(paths: string[]): TreeNode[] {
  const folders = new Map<string, TreeFolder>([['', { kind: 'folder', path: '', name: '', children: [] }]]);
  for (const path of paths) {
    folderFor(folders, folderOf(path)).children.push({ kind: 'file', path, name: baseName(path) });
  }
  return sortNodes(folders.get('')!.children);
}

function folderFor(folders: Map<string, TreeFolder>, path: string): TreeFolder {
  const held = folders.get(path);
  if (held) return held;
  const made: TreeFolder = { kind: 'folder', path, name: baseName(path), children: [] };
  folders.set(path, made);
  folderFor(folders, folderOf(path)).children.push(made);
  return made;
}

function sortNodes(nodes: TreeNode[]): TreeNode[] {
  for (const node of nodes) if (node.kind === 'folder') sortNodes(node.children);
  return nodes.sort((a, b) => foldersFirst(a, b) || a.name.localeCompare(b.name));
}

function foldersFirst(a: TreeNode, b: TreeNode): number {
  return Number(a.kind === 'file') - Number(b.kind === 'file');
}

export function visibleRows(nodes: TreeNode[], isOpen: (path: string) => boolean, depth = 0): TreeRow[] {
  return nodes.flatMap((node) => {
    const row = { node, depth };
    if (node.kind === 'file' || !isOpen(node.path)) return [row];
    return [row, ...visibleRows(node.children, isOpen, depth + 1)];
  });
}

export function ancestorFolders(path: string): string[] {
  const folders: string[] = [];
  for (let at = folderOf(path); at !== ''; at = folderOf(at)) folders.push(at);
  return folders;
}
