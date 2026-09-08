'use client';

import { useCallback } from 'react';
import { useDiffAreaWidth } from './diffAreaWidth';
import { finiteNumber, recordPref, usePref } from './localPref';
import { useNarrowViewport } from './narrowViewport';
import { pullSubject } from './pullPaths';
import { clampBetween, useDragWidth, type ColumnSize } from './ResizableColumn';
import { useReviewTarget, type ReviewThreadTarget } from './reviewThreadStore';

const MIN_DIFF_WIDTH = 640;
const MAX_DIFF_WIDTH = 1200;
const DIFF_SHARE = 2 / 3;

export const MARKER_SIZE = 18;
export const MARKER_GAP = 2;
export const MARKER_STRIP_WIDTH = MARKER_SIZE + MARKER_GAP * 2;
export const MIN_CARD_WIDTH = 120;

export interface CommentColumn {
  width: number;
  resizable: boolean;
}

const widthsPref = recordPref('reposcope.commentColumnWidths', finiteNumber);

export function useCommentColumn(): CommentColumn {
  const width = useFittedWidth(useReviewTarget());
  const narrow = useNarrowViewport();
  if (narrow) return { width: MARKER_STRIP_WIDTH, resizable: false };
  return { width, resizable: true };
}

export function useDiffWidth(): number {
  return useDiffAreaWidth() - useCommentColumn().width;
}

export function useCommentColumnDrag(width: number) {
  const key = pullKey(useReviewTarget());
  const available = useDiffAreaWidth();
  const clamp = useCallback((dragged: number) => fitWidth(dragged, available), [available]);
  const remember = useCallback((next: ColumnSize) => rememberWidth(key, next.width), [key]);
  return useDragWidth({ width, open: true }, remember, 'left', clamp);
}

function useFittedWidth(target: ReviewThreadTarget): number {
  const stored = usePref(widthsPref)[pullKey(target)];
  const available = useDiffAreaWidth();
  return stored === undefined ? defaultWidth(available) : fitWidth(stored, available);
}

function rememberWidth(key: string, width: number): void {
  widthsPref.set({ ...widthsPref.read(), [key]: width });
}

function pullKey({ owner, repo, number }: ReviewThreadTarget): string {
  return pullSubject(owner, repo, number ?? 0);
}

function defaultWidth(available: number): number {
  const diff = Math.min(available, clampBetween(available * DIFF_SHARE, MIN_DIFF_WIDTH, MAX_DIFF_WIDTH));
  return snapNarrow(Math.round(available - diff));
}

function fitWidth(width: number, available: number): number {
  return snapNarrow(Math.round(clampBetween(width, 0, maxWidth(available))));
}

function maxWidth(available: number): number {
  return available - Math.min(MIN_DIFF_WIDTH, available / 2);
}

function snapNarrow(width: number): number {
  if (width >= MARKER_STRIP_WIDTH) return width;
  return width < MARKER_STRIP_WIDTH / 2 ? 0 : MARKER_STRIP_WIDTH;
}
