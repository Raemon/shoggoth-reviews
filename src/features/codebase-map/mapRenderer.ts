import { contentRect, formatBytes, hasMapDetail, type MapNode, type MapPartition, type Rect } from './mapLayout';
import { screenRect, visibleRect, type Camera, type Viewport } from './mapCamera';

export interface CodePreview { lines: string[] }
export interface MapScene {
  root: MapNode;
  selected: string | null;
  query: string;
  expanded: ReadonlyMap<string, CodePreview>;
}
export interface PaintView { camera: Camera; viewport: Viewport; hover: string | null }

const COLORS = ['#76bda6', '#81a9d5', '#b5a1d4', '#c4b27d', '#79b9c8', '#bd91a2'];

export function nodeColor(path: string): string {
  let hash = 0;
  const group = path.split('/')[0] ?? '';
  for (const letter of group) hash = (hash * 31 + letter.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length]!;
}

export function paintMap(ctx: CanvasRenderingContext2D, scene: MapScene, view: PaintView): void {
  ctx.fillStyle = '#202326';
  ctx.fillRect(0, 0, view.viewport.width, view.viewport.height);
  paintNode(ctx, scene.root, scene, view);
}

function paintNode(ctx: CanvasRenderingContext2D, node: MapNode, scene: MapScene, view: PaintView): void {
  const rect = screenRect(node, view.camera);
  if (!visibleRect(rect, view.viewport) || rect.width < 0.8 || rect.height < 0.8) return;
  paintTile(ctx, node, rect, scene, view);
  if (node.partition && hasMapDetail(node, view.camera.scale)) paintPartition(ctx, node.partition, node, scene, view);
}

function paintPartition(ctx: CanvasRenderingContext2D, partition: MapPartition, owner: MapNode, scene: MapScene, view: PaintView): void {
  const rect = screenRect(partition, view.camera);
  if (!visibleRect(rect, view.viewport)) return;
  if (!hasMapDetail(partition, view.camera.scale)) return paintAggregate(ctx, rect, owner.path);
  if (partition.node) return paintNode(ctx, partition.node, scene, view);
  for (const child of partition.children) paintPartition(ctx, child, owner, scene, view);
}

function paintAggregate(ctx: CanvasRenderingContext2D, rect: Rect, path: string): void {
  const gap = Math.min(0.7, rect.width * 0.08, rect.height * 0.08);
  ctx.fillStyle = nodeColor(path) + '35';
  ctx.fillRect(rect.x + gap, rect.y + gap, rect.width - gap * 2, rect.height - gap * 2);
}

function paintTile(ctx: CanvasRenderingContext2D, node: MapNode, rect: Rect, scene: MapScene, view: PaintView): void {
  const selected = scene.selected === node.path;
  const matched = !scene.query || node.path.toLowerCase().includes(scene.query);
  const color = nodeColor(node.path);
  ctx.globalAlpha = matched || node.directory ? 1 : 0.22;
  tileBox(ctx, rect, color, node.directory, selected || view.hover === node.path);
  if (rect.width > 28 && rect.height > 13) tileContent(ctx, node, rect, scene, view);
  ctx.globalAlpha = 1;
}

function tileBox(ctx: CanvasRenderingContext2D, rect: Rect, color: string, directory: boolean, active: boolean): void {
  ctx.fillStyle = active ? '#35444a' : directory ? '#272d30' : '#22272b';
  ctx.fillRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1);
  ctx.strokeStyle = active ? '#e8e6c5' : color + (directory ? 'b0' : '65');
  ctx.lineWidth = active ? 2 : 0.7;
  ctx.strokeRect(rect.x + 1, rect.y + 1, Math.max(0, rect.width - 2), Math.max(0, rect.height - 2));
}

function tileContent(ctx: CanvasRenderingContext2D, node: MapNode, rect: Rect, scene: MapScene, view: PaintView): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x + 3, rect.y + 2, rect.width - 6, rect.height - 4);
  ctx.clip();
  tileLabel(ctx, node, rect, view.camera);
  const code = scene.expanded.get(node.path);
  if (!node.directory && rect.height > 45) fileBody(ctx, node, rect, code, view.viewport);
  ctx.restore();
}

function tileLabel(ctx: CanvasRenderingContext2D, node: MapNode, rect: Rect, camera: Camera): void {
  const headerHeight = node.directory ? (contentRect(node).y - node.y) * camera.scale : 22;
  if (headerHeight < 7) return;
  const fontSize = Math.min(12, headerHeight * 0.7);
  ctx.font = `${node.directory ? '600 ' : ''}${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.fillStyle = node.directory ? nodeColor(node.path) : '#d4dedf';
  ctx.fillText(`${node.directory ? '▾ ' : '▸ '}${node.name}`, rect.x + 5, rect.y + Math.min(16, headerHeight - 2));
}

function fileBody(ctx: CanvasRenderingContext2D, node: MapNode, rect: Rect, code: CodePreview | undefined, viewport: Viewport): void {
  if (code) return paintCode(ctx, rect, code, viewport);
  if (rect.width < 70) return;
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#82959d';
  ctx.fillText(formatBytes(node.bytes), rect.x + 6, rect.y + 35);
  if (rect.height > 85 && rect.width > 145) ctx.fillText('Double-click to read', rect.x + 6, rect.y + 53);
}

function paintCode(ctx: CanvasRenderingContext2D, rect: Rect, code: CodePreview, viewport: Viewport): void {
  const fontSize = Math.max(2, Math.min(12, (rect.width - 14) / 65));
  const lineHeight = fontSize * 1.5;
  const start = Math.max(0, Math.floor((-rect.y - 30) / lineHeight));
  const end = Math.min(code.lines.length, Math.floor((Math.min(rect.height, viewport.height - rect.y) - 30) / lineHeight));
  ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  for (let i = start; i < end; i++) paintCodeLine(ctx, code.lines[i]!, rect.x + 6, rect.y + 30 + i * lineHeight);
}

function paintCodeLine(ctx: CanvasRenderingContext2D, line: string, x: number, y: number): void {
  ctx.fillStyle = /^\s*(\/\/|#|\/\*|\*)/.test(line) ? '#789184' : /^\s*(import|export|pub|fn|def|class|function|const|let|type|interface)\b/.test(line) ? '#a3bad7' : '#bdc8c9';
  ctx.fillText(line.slice(0, 240), x, y);
}

export function paintMinimap(ctx: CanvasRenderingContext2D, root: MapNode, camera: Camera, viewport: Viewport): void {
  ctx.clearRect(0, 0, 160, 108);
  if (root.partition) miniPartition(ctx, root.partition, root);
  ctx.strokeStyle = '#f2e5b1';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-camera.x / camera.scale / root.width * 160, -camera.y / camera.scale / root.height * 108, viewport.width / camera.scale / root.width * 160, viewport.height / camera.scale / root.height * 108);
}

function miniPartition(ctx: CanvasRenderingContext2D, partition: MapPartition, root: MapNode): void {
  if (partition.node || !hasMapDetail(partition, Math.min(160 / root.width, 108 / root.height))) return miniTile(ctx, partition, root);
  for (const child of partition.children) miniPartition(ctx, child, root);
}

function miniTile(ctx: CanvasRenderingContext2D, partition: MapPartition, root: MapNode): void {
  ctx.fillStyle = nodeColor(partition.node?.path ?? root.path) + '55';
  ctx.fillRect(partition.x / root.width * 160, partition.y / root.height * 108, Math.max(1, partition.width / root.width * 160 - 1), Math.max(1, partition.height / root.height * 108 - 1));
}
