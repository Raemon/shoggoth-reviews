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

export interface RowHeights {
  wrapped: WrappedHeights;
  blank: number;
  openBlank: number;
  openRows: ReadonlySet<number>;
}

const BLANK_ROW_HEIGHTS: Record<BlankLineSetting, number> = { full: ROW_HEIGHT, half: HALF_ROW_HEIGHT, 'extra-small': 2 };
const OPEN_BLANK_ROW_HEIGHTS: Record<BlankLineSetting, number> = { full: ROW_HEIGHT, half: 11, 'extra-small': 6 };

export function blankRowHeight(setting: BlankLineSetting): number {
  return BLANK_ROW_HEIGHTS[setting];
}

export function openBlankRowHeight(setting: BlankLineSetting): number {
  return OPEN_BLANK_ROW_HEIGHTS[setting];
}

export function lineHeight(line: DiffLine, heights: RowHeights): number {
  if (line.blank) return blankHeight(line, heights);
  if (line.semiblank) return HALF_ROW_HEIGHT;
  return heights.wrapped?.get(line.row)?.[line.side] ?? ROW_HEIGHT;
}

function blankHeight(line: DiffLine, heights: RowHeights): number {
  return heights.openRows.has(line.row) ? heights.openBlank : heights.blank;
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
