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
  onOverflow,
}: {
  threads: ReviewThread[];
  rows: DiffRow[];
  lines: DiffLine[];
  heights: RowHeights;
  onOverflow: (pixels: number) => void;
}) {
  const { width, resizable } = useCommentColumn();
  const startDrag = useCommentColumnDrag(width);
  const anchors = useMemo(() => anchorThreads(threads, rows, lines, heights), [threads, rows, lines, heights]);
  return (
    <div className={`relative shrink-0 bg-shade ${width > 0 ? 'border-l border-panel-edge' : ''}`} style={{ width }}>
      {width >= MIN_CARD_WIDTH ? (
        <ThreadColumn anchors={anchors} lines={lines} heights={heights} onOverflow={onOverflow} />
      ) : (
        <ThreadMarkers anchors={anchors} collapsed={width === 0} onOverflow={onOverflow} />
      )}
      {resizable && <DragHandle onPointerDown={startDrag} edge="left" outside={width === 0} />}
    </div>
  );
}
