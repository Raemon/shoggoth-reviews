'use client';

import { useMemo } from 'react';
import { anchorThreads } from './commentAnchors';
import type { RowHeights } from './diffMetrics';
import type { DiffLine } from './diffLines';
import { useNarrowViewport } from './narrowViewport';
import type { ReviewThread } from './reviewThreads';
import type { DiffRow } from './splitDiff';
import { ThreadColumn } from './ThreadColumn';
import { ThreadMarkers } from './ThreadMarkers';

export function InlineThreads({
  threads,
  rows,
  lines,
  heights,
  foldAnchors,
  onOverflow,
}: {
  threads: ReviewThread[];
  rows: DiffRow[];
  lines: DiffLine[];
  heights: RowHeights;
  foldAnchors?: ReadonlyMap<number, { collapsed: boolean }>;
  onOverflow: (pixels: number) => void;
}) {
  const narrow = useNarrowViewport();
  const anchors = useMemo(() => anchorThreads(threads, rows, lines, heights, foldAnchors), [threads, rows, lines, heights, foldAnchors]);
  if (narrow) return <ThreadMarkers anchors={anchors} onOverflow={onOverflow} />;
  return <ThreadColumn anchors={anchors} lines={lines} heights={heights} foldAnchors={foldAnchors} onOverflow={onOverflow} />;
}
