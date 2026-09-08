'use client';

import { clampedPref, usePref } from './localPref';
import { clampWidth, type ColumnSize } from './ResizableColumn';

const MIN_RIGHT_PANE = 200;

const widthPref = clampedPref('reposcope.diffPaneWidth', null, clampWidth);

export function useDiffPaneWidth(diffWidth: number): number {
  const stored = usePref(widthPref);
  const half = Math.round(diffWidth / 2);
  const widest = Math.max(half, diffWidth - MIN_RIGHT_PANE);
  return Math.min(stored ?? half, widest);
}

export function setDiffPaneWidth(next: ColumnSize): void {
  widthPref.set(clampWidth(next.width));
}
