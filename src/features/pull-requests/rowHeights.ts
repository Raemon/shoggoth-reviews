'use client';

import { ROW_HEIGHT, type RowHeight, type WrappedHeights } from './diffMetrics';

export const WRAPPED_CELL = 'data-wrapped-cell';

const HANGING_STEP = 4;
const MAX_HANGING_INDENT = 40;
const TAB_SIZE = 8;

/** Continuations start here: the line's own indent, plus a step that marks them as continuations. */
export function hangingIndent(text: string): number {
  return Math.min(MAX_HANGING_INDENT, leadingColumns(text) + HANGING_STEP);
}

function leadingColumns(text: string): number {
  let columns = 0;
  for (const char of text.match(/^[ \t]*/u)?.[0] ?? '') columns += char === '\t' ? TAB_SIZE - (columns % TAB_SIZE) : 1;
  return columns;
}

/** Read from the laid-out cells: line breaking is the browser's to know, not ours to predict. */
export function measureRowHeights(container: HTMLElement): WrappedHeights {
  const heights = new Map<number, RowHeight>();
  for (const cell of container.querySelectorAll<HTMLElement>(`[${WRAPPED_CELL}]`)) {
    const { row, side } = cellKey(cell);
    // An empty cell measures 0, but its row is never drawn shorter than ROW_HEIGHT.
    const height = Math.max(ROW_HEIGHT, cell.offsetHeight);
    heights.set(row, { ...rowHeightAt(heights, row), [side]: height });
  }
  return heights;
}

function cellKey(cell: HTMLElement): { row: number; side: 'left' | 'right' } {
  const [side, row] = (cell.getAttribute(WRAPPED_CELL) ?? '').split(':');
  return { row: Number(row), side: side === 'left' ? 'left' : 'right' };
}

function rowHeightAt(heights: WrappedHeights, row: number): RowHeight {
  return heights?.get(row) ?? { left: ROW_HEIGHT, right: ROW_HEIGHT };
}

/** Split panes only line up if a row is as tall as the taller of the two cells across from it. */
export function evenedRowHeights(left: WrappedHeights, right: WrappedHeights): WrappedHeights {
  if (!left || !right) return null;
  const heights = new Map<number, RowHeight>();
  for (const row of new Set([...left.keys(), ...right.keys()])) {
    const tallest = Math.max(rowHeightAt(left, row).left, rowHeightAt(right, row).right);
    heights.set(row, { left: tallest, right: tallest });
  }
  return heights;
}

export function sameRowHeights(held: WrappedHeights, next: WrappedHeights): boolean {
  if (!held || !next) return held === next;
  if (held.size !== next.size) return false;
  return [...held].every(([row, { left, right }]) => sameHeight(next.get(row), left, right));
}

function sameHeight(height: RowHeight | undefined, left: number, right: number): boolean {
  return height?.left === left && height.right === right;
}
