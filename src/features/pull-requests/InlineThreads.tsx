'use client';

import { useMemo } from 'react';
import { anchorThreads } from './commentAnchors';
import { MIN_CARD_WIDTH, useCommentColumn, useCommentColumnDrag } from './commentColumnWidth';
import type { RowHeights } from './diffMetrics';
import type { DiffLine } from './diffLines';
import { DragHandle } from './ResizableColumn';
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
  const { width, resizable } = useCommentColumn();
  const startDrag = useCommentColumnDrag(width);
  const anchors = useMemo(() => anchorThreads(threads, rows, lines, heights, foldAnchors), [threads, rows, lines, heights, foldAnchors]);
  const collapsed = width === 0;
  return (
    <div className={`relative shrink-0 bg-shade ${collapsed ? '' : 'border-l border-panel-edge'}`} style={{ width }}>
      {width >= MIN_CARD_WIDTH ? (
        <ThreadColumn anchors={anchors} lines={lines} heights={heights} foldAnchors={foldAnchors} onOverflow={onOverflow} />
      ) : (
        <ThreadMarkers anchors={anchors} lines={lines} heights={heights} collapsed={collapsed} onOverflow={onOverflow} />
      )}
      {resizable && <DragHandle onPointerDown={startDrag} edge="left" outside={collapsed} />}
    </div>
  );
}
