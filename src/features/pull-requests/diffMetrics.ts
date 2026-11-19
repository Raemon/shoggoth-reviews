import type { DiffLine } from './diffLines';
import type { BlankLineSetting } from '@/features/settings/settings';

export const ROW_HEIGHT = 15;
export const HALF_ROW_HEIGHT = ROW_HEIGHT / 2;
export const COLLAPSED_ROW_GAP = 2;
export const SAVE_BAR = 28;
export const EXPAND_MS = 200;

export interface RowHeight {
  left: number;
  right: number;
}

/** Row index to per-side height, for rows wrapped past one line; null when wrapping is off. */
export type WrappedHeights = Map<number, RowHeight> | null;

export type FoldAnchors = ReadonlyMap<number, { collapsed: boolean }>;

/** open: drawn beside code, where the gap has to read; closed: wedged between two collapsed folds. */
export interface BlankHeights {
  closed: number;
  open: number;
}

export interface RowHeights {
  wrapped: WrappedHeights;
  blank: BlankHeights;
  openRows: ReadonlySet<number>;
}

const BLANK_ROW_HEIGHTS: Record<BlankLineSetting, BlankHeights> = {
  full: { closed: ROW_HEIGHT, open: ROW_HEIGHT },
  half: { closed: HALF_ROW_HEIGHT, open: 11 },
  'extra-small': { closed: 2, open: 6 },
};

export function blankRowHeights(setting: BlankLineSetting): BlankHeights {
  return BLANK_ROW_HEIGHTS[setting];
}

export function lineHeight(line: DiffLine, heights: RowHeights): number {
  if (line.blank) return heights.openRows.has(line.row) ? heights.blank.open : heights.blank.closed;
  if (line.semiblank) return HALF_ROW_HEIGHT;
  return heights.wrapped?.get(line.row)?.[line.side] ?? ROW_HEIGHT;
}

export function collapsedRowGap(line: DiffLine, next: DiffLine | undefined, anchors: FoldAnchors): number {
  if (!next || !anchors.get(line.row)?.collapsed || !anchors.get(next.row)?.collapsed) return 0;
  return COLLAPSED_ROW_GAP;
}

export function linesHeight(
  lines: DiffLine[],
  heights: RowHeights,
  anchors?: FoldAnchors,
): number {
  return lines.reduce(
    (total, line, index) => total + lineHeight(line, heights) + (anchors ? collapsedRowGap(line, lines[index + 1], anchors) : 0),
    0,
  );
}
