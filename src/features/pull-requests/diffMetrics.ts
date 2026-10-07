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
}

const BLANK_ROW_HEIGHTS: Record<BlankLineSetting, number> = { full: ROW_HEIGHT, half: HALF_ROW_HEIGHT, 'extra-small': 2 };

export function blankRowHeight(setting: BlankLineSetting): number {
  return BLANK_ROW_HEIGHTS[setting];
}

export function lineHeight(line: DiffLine, heights: RowHeights): number {
  if (line.kind === 'fold') return ROW_HEIGHT;
  if (line.blank) return heights.blank;
  if (line.semiblank) return HALF_ROW_HEIGHT;
  return heights.wrapped?.get(line.row)?.[line.side] ?? ROW_HEIGHT;
}

// Separates two collapsed folds in a row; a fold's own removed/added summary pair stays together.
export function collapsedRowGap(line: DiffLine, next: DiffLine | undefined): number {
  if (!line.fold || !next?.fold || line.fold.control === next.fold.control) return 0;
  return COLLAPSED_ROW_GAP;
}

export function linesHeight(lines: DiffLine[], heights: RowHeights): number {
  return lines.reduce((total, line, index) => total + lineHeight(line, heights) + collapsedRowGap(line, lines[index + 1]), 0);
}
