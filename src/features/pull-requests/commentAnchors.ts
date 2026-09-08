import { linesHeight, ROW_HEIGHT, type RowHeights } from './diffMetrics';
import type { DiffLine } from './diffLines';
import { isDraftThread } from './draftThread';
import type { ReviewThread } from './reviewThreads';
import type { DiffRow } from './splitDiff';

export interface AnchoredThread {
  thread: ReviewThread;
  row: number;
  anchorTop: number;
}

export interface PlacedThread extends Omit<AnchoredThread, 'anchorTop'> {
  top: number;
  slot: number;
}

export function anchorThreads(
  threads: ReviewThread[],
  rows: DiffRow[],
  lines: DiffLine[],
  heights: RowHeights,
  foldAnchors?: ReadonlyMap<number, { collapsed: boolean }>,
): AnchoredThread[] {
  return threads
    .map((thread) => anchoredThread(thread, rows, lines, heights, foldAnchors))
    .filter((anchored): anchored is AnchoredThread => anchored !== null)
    .sort((a, b) => a.anchorTop - b.anchorTop);
}

export function placeThreads(anchors: AnchoredThread[], heights: Record<number, number>, gap: number, minSlot: number): PlacedThread[] {
  const tops = stackedTops(anchors, heights, gap, minSlot);
  return anchors.map(({ thread, row }, index) => {
    const top = tops[index] ?? 0;
    const nextTop = tops[index + 1] ?? Infinity;
    return { thread, row, top, slot: nextTop - gap - top };
  });
}

function stackedTops(anchors: AnchoredThread[], heights: Record<number, number>, gap: number, minSlot: number): number[] {
  let floor = 0;
  return anchors.map(({ thread, anchorTop }) => {
    const top = Math.max(anchorTop, floor);
    floor = top + reservedHeight(thread, heights, minSlot) + gap;
    return top;
  });
}

// A composer must never be clipped, so it reserves its full height instead of one slot.
function reservedHeight(thread: ReviewThread, heights: Record<number, number>, minSlot: number): number {
  const natural = heights[thread.rootId] ?? ROW_HEIGHT;
  return isDraftThread(thread) ? natural : Math.min(natural, minSlot);
}

function anchoredThread(
  thread: ReviewThread,
  rows: DiffRow[],
  lines: DiffLine[],
  heights: RowHeights,
  foldAnchors?: ReadonlyMap<number, { collapsed: boolean }>,
): AnchoredThread | null {
  const row = rowOf(thread, rows);
  if (row < 0) return null;
  const index = displayIndexOf(row, thread.side, lines);
  return index < 0 ? null : { thread, row, anchorTop: linesHeight(lines.slice(0, index), heights, foldAnchors) };
}

export function rowOf(thread: ReviewThread, rows: DiffRow[]): number {
  if (thread.line === null) return -1;
  return rows.findIndex((row) => row[thread.side]?.line === thread.line);
}

function displayIndexOf(row: number, side: 'left' | 'right', lines: DiffLine[]): number {
  const onSide = lines.findIndex((line) => line.row === row && line.side === side);
  return onSide >= 0 ? onSide : lines.findIndex((line) => line.row === row);
}
