import type { RepoFileSet } from '@/features/pull-requests/repoFiles';

export interface Rect { x: number; y: number; width: number; height: number }
export interface MapNode extends Rect {
  path: string;
  name: string;
  directory: boolean;
  children: MapNode[];
  partition: MapPartition | null;
  weight: number;
  bytes: number;
  count: number;
}
export type MapPartition = Rect & ({ node: MapNode; children?: never } | { node?: never; children: [MapPartition, MapPartition] });
export interface MapLayout { root: MapNode; byPath: Map<string, MapNode>; files: MapNode[] }
export const WORLD: Rect = { x: 0, y: 0, width: 2400, height: 1600 };
const DETAIL_SIZE = 10;

export function buildMap(fileSet: RepoFileSet): MapLayout {
  const root = makeNode('', true);
  const byPath = new Map([['', root]]);
  const files = fileSet.files.map((path) => insertFile(path, fileSet.sizes?.[path] ?? 1024, byPath));
  totalNode(root);
  placeNode(root, WORLD);
  return { root, byPath, files };
}

function makeNode(path: string, directory: boolean): MapNode {
  return { ...WORLD, path, name: path.split('/').at(-1) || 'Repository', directory, children: [], partition: null, weight: 0, bytes: 0, count: 0 };
}

function insertFile(path: string, bytes: number, byPath: Map<string, MapNode>): MapNode {
  const parentPath = path.slice(0, Math.max(0, path.lastIndexOf('/')));
  const parent = ensureDirectory(parentPath, byPath);
  const node = { ...makeNode(path, false), bytes, weight: Math.sqrt(Math.max(256, Math.min(bytes, 256_000))), count: 1 };
  parent.children.push(node);
  byPath.set(path, node);
  return node;
}

function ensureDirectory(path: string, byPath: Map<string, MapNode>): MapNode {
  const held = byPath.get(path);
  if (held) return held;
  const node = makeNode(path, true);
  byPath.set(path, node);
  ensureDirectory(path.slice(0, Math.max(0, path.lastIndexOf('/'))), byPath).children.push(node);
  return node;
}

function totalNode(node: MapNode): void {
  if (!node.directory) return;
  for (const child of node.children) addChildTotals(node, child);
  node.children.sort((a, b) => b.weight - a.weight || a.path.localeCompare(b.path));
}

function addChildTotals(node: MapNode, child: MapNode): void {
  totalNode(child);
  node.weight += child.weight;
  node.bytes += child.bytes;
  node.count += child.count;
}

function placeNode(node: MapNode, rect: Rect): void {
  Object.assign(node, rect);
  if (!node.children.length) return;
  node.partition = partition(node.children, contentRect(rect), node.weight);
}

export function contentRect(rect: Rect): Rect {
  const pad = Math.min(7, rect.width * 0.025, rect.height * 0.025);
  const title = Math.min(24, rect.height * 0.12);
  return { x: rect.x + pad, y: rect.y + title, width: rect.width - pad * 2, height: rect.height - title - pad };
}

function partition(nodes: MapNode[], rect: Rect, total: number): MapPartition {
  if (nodes.length === 1) return placeLeaf(nodes[0]!, rect);
  const [index, weight] = splitWeight(nodes, total);
  const [first, second] = splitRect(rect, weight / total);
  return { ...rect, children: [partition(nodes.slice(0, index), first, weight), partition(nodes.slice(index), second, total - weight)] };
}

function placeLeaf(node: MapNode, rect: Rect): MapPartition {
  placeNode(node, rect);
  return { ...rect, node };
}

function splitWeight(nodes: MapNode[], total: number): [number, number] {
  let weight = nodes[0]!.weight;
  let index = 1;
  while (index < nodes.length - 1 && weight + nodes[index]!.weight / 2 < total / 2) weight += nodes[index++]!.weight;
  return [index, weight];
}

function splitRect(rect: Rect, ratio: number): [Rect, Rect] {
  if (rect.width > rect.height) return splitAxis(rect, ratio, 'x', 'width');
  return splitAxis(rect, ratio, 'y', 'height');
}

function splitAxis(rect: Rect, ratio: number, axis: 'x' | 'y', size: 'width' | 'height'): [Rect, Rect] {
  const length = rect[size] * ratio;
  return [{ ...rect, [size]: length }, { ...rect, [axis]: rect[axis] + length, [size]: rect[size] - length }];
}

export function contains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && y >= rect.y && x <= rect.x + rect.width && y <= rect.y + rect.height;
}

export function hasMapDetail(rect: Rect, scale: number): boolean {
  return rect.width * scale >= DETAIL_SIZE && rect.height * scale >= DETAIL_SIZE;
}

export function hitNode(node: MapNode, x: number, y: number, scale = Infinity): MapNode | null {
  if (!contains(node, x, y)) return null;
  if (!node.partition || !hasMapDetail(node, scale)) return node;
  return hitPartition(node.partition, x, y, scale, node) ?? node;
}

function hitPartition(partition: MapPartition, x: number, y: number, scale: number, ancestor: MapNode): MapNode | null {
  if (!contains(partition, x, y)) return null;
  if (!hasMapDetail(partition, scale)) return ancestor;
  if (partition.node) return hitNode(partition.node, x, y, scale);
  return hitPartition(partition.children[0], x, y, scale, ancestor) ?? hitPartition(partition.children[1], x, y, scale, ancestor);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
