'use client';

import { useCallback } from 'react';
import { useDiffAreaWidth } from './diffAreaWidth';
import type { DraftAnchor } from './draftThread';
import { useDraftAnchor } from './draftThreadStore';
import { localPref, usePref } from './localPref';
import { useNarrowViewport } from './narrowViewport';
import { useDragWidth, type ColumnSize } from './ResizableColumn';
import { useReviewTarget, type ReviewThreadTarget } from './reviewThreadStore';

const MIN_DIFF_WIDTH = 640;
const MAX_DIFF_WIDTH = 1200;
const DIFF_SHARE = 2 / 3;

export const MARKER_SIZE = 18;
export const MARKER_GAP = 2;
export const MARKER_STRIP_WIDTH = MARKER_SIZE + MARKER_GAP * 2;
export const MIN_CARD_WIDTH = 75;

export interface CommentColumn {
  width: number;
  resizable: boolean;
}

const widthsPref = localPref<Record<string, number>>('reposcope.commentColumnWidths', {}, decodeWidths);

export function useCommentColumn(): CommentColumn {
  const target = useReviewTarget();
  const stored = usePref(widthsPref)[pullKey(target)] ?? null;
  const available = useDiffAreaWidth();
  const narrow = useNarrowViewport();
  const shown = target.threads.length > 0 || draftedIn(target, useDraftAnchor());
  if (!shown) return { width: 0, resizable: false };
  if (narrow) return { width: MARKER_STRIP_WIDTH, resizable: false };
  return { width: stored === null ? defaultWidth(available) : clampCommentWidth(stored, available), resizable: true };
}

export function useDiffWidth(): number {
  return useDiffAreaWidth() - useCommentColumn().width;
}

export function useCommentColumnDrag(width: number) {
  const key = pullKey(useReviewTarget());
  const available = useDiffAreaWidth();
  const clamp = useCallback((dragged: number) => clampCommentWidth(dragged, available), [available]);
  const remember = useCallback((next: ColumnSize) => rememberWidth(key, next.width), [key]);
  return useDragWidth({ width, open: true }, remember, 'left', clamp);
}

function rememberWidth(key: string, width: number): void {
  widthsPref.set({ ...widthsPref.read(), [key]: width });
}

function pullKey({ owner, repo, number }: ReviewThreadTarget): string {
  return `${owner}/${repo}#${number}`;
}

function draftedIn({ owner, repo, number }: ReviewThreadTarget, draft: DraftAnchor | null): boolean {
  return draft !== null && draft.owner === owner && draft.repo === repo && draft.number === number;
}

function defaultWidth(available: number): number {
  const diff = Math.min(available, clampBetween(available * DIFF_SHARE, MIN_DIFF_WIDTH, MAX_DIFF_WIDTH));
  return snapNarrow(Math.round(available - diff));
}

function clampCommentWidth(width: number, available: number): number {
  return snapNarrow(Math.round(clampBetween(width, 0, maxWidth(available))));
}

function maxWidth(available: number): number {
  return Math.max(0, available - Math.min(MIN_DIFF_WIDTH, available / 2));
}

function snapNarrow(width: number): number {
  if (width >= MARKER_STRIP_WIDTH) return width;
  return width < MARKER_STRIP_WIDTH / 2 ? 0 : MARKER_STRIP_WIDTH;
}

function clampBetween(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function decodeWidths(stored: unknown): Record<string, number> | undefined {
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return undefined;
  return Object.fromEntries(Object.entries(stored).filter(([, width]) => typeof width === 'number' && Number.isFinite(width)));
}
