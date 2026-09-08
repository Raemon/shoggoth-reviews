import type { DiffLine } from './diffLines';

export const ROW_HEIGHT = 15;
export const BLANK_ROW_HEIGHT = 2;
export const COLLAPSED_ROW_GAP = 2;
export const SAVE_BAR = 28;
export const EXPAND_MS = 200;

export interface RowHeight {
  left: number;
  right: number;
}

/** Row index to per-side height, for rows wrapped past one line; null when wrapping is off. */
export type RowHeights = Map<number, RowHeight> | null;

export function lineHeight(line: DiffLine, heights: RowHeights): number {
  if (line.blank) return BLANK_ROW_HEIGHT;
  return heights?.get(line.row)?.[line.side] ?? ROW_HEIGHT;
}

export function collapsedRowGap(
  line: DiffLine,
  next: DiffLine | undefined,
  anchors: ReadonlyMap<number, { collapsed: boolean }>,
): number {
  if (!next || !anchors.get(line.row)?.collapsed || !anchors.get(next.row)?.collapsed) return 0;
  return COLLAPSED_ROW_GAP;
}

export function linesHeight(
  lines: DiffLine[],
  heights: RowHeights,
  anchors?: ReadonlyMap<number, { collapsed: boolean }>,
): number {
  return lines.reduce(
    (total, line, index) => total + lineHeight(line, heights) + (anchors ? collapsedRowGap(line, lines[index + 1], anchors) : 0),
    0,
  );
}
