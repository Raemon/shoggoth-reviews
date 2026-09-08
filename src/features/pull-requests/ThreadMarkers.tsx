'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { overflowPast, placeThreads, type AnchoredThread, type PlacedThread } from './commentAnchors';
import { MARKER_GAP, MARKER_SIZE } from './commentColumnWidth';
import { AuthorPortrait } from './CommentByline';
import { linesHeight, type RowHeights } from './diffMetrics';
import type { DiffLine } from './diffLines';
import { isDraftThread } from './draftThread';
import { clearDraftThread } from './draftThreadStore';
import { rowLighting } from './litRow';
import type { ReviewThread } from './reviewThreads';
import { ThreadCard } from './ThreadCard';
import { ANCHOR_ATTR, ThreadPopover } from './ThreadPopover';
import { HoverCardTrigger } from '@/features/surface-ui/HoverCard';

const MAX_SNIPPET_CHARS = 80;

export function ThreadMarkers({
  anchors,
  lines,
  heights,
  collapsed,
  onOverflow,
}: {
  anchors: AnchoredThread[];
  lines: DiffLine[];
  heights: RowHeights;
  collapsed: boolean;
  onOverflow: (pixels: number) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const markers = placeThreads(anchors, markerHeights(anchors), MARKER_GAP, MARKER_SIZE);
  const opened = openedThread(markers, picked);
  const overflow = collapsed ? 0 : markersOverflow(markers, linesHeight(lines, heights));
  const toggle = useCallback((rootId: number) => setPicked((held) => (held === rootId ? null : rootId)), []);

  useEffect(() => onOverflow(overflow), [overflow, onOverflow]);

  return (
    <>
      {!collapsed &&
        markers.map((marker) => (
          <MarkerButton
            key={marker.thread.rootId}
            row={marker.row}
            top={marker.top}
            thread={marker.thread}
            open={marker.thread === opened?.thread}
            onOpen={toggle}
          />
        ))}
      {opened && (
        <ThreadPopover
          top={opened.top}
          label={threadLabel(opened.thread)}
          dismissOnBlur={!isDraftThread(opened.thread)}
          onDismiss={() => dismissThread(setPicked)}
        >
          <ThreadCard thread={opened.thread} />
        </ThreadPopover>
      )}
    </>
  );
}

// Draft first: a new composer must replace whatever card is open, not wait behind it.
function openedThread(markers: PlacedThread[], picked: number | null): PlacedThread | null {
  const drafted = markers.find(({ thread }) => isDraftThread(thread));
  return drafted ?? markers.find(({ thread }) => thread.rootId === picked) ?? null;
}

function markersOverflow(markers: PlacedThread[], diffHeight: number): number {
  return overflowPast(markers.map((marker) => marker.top + MARKER_SIZE), diffHeight);
}

function markerHeights(anchors: AnchoredThread[]): Record<number, number> {
  return Object.fromEntries(anchors.map(({ thread }) => [thread.rootId, MARKER_SIZE]));
}

function dismissThread(setPicked: (rootId: number | null) => void) {
  clearDraftThread();
  setPicked(null);
}

function MarkerButton({
  row,
  top,
  thread,
  open,
  onOpen,
}: {
  row: number;
  top: number;
  thread: ReviewThread;
  open: boolean;
  onOpen: (rootId: number) => void;
}) {
  const label = markerLabel(thread);
  return (
    <div {...rowLighting(row)} {...{ [ANCHOR_ATTR]: '' }} style={{ top }} className="absolute inset-x-0 flex justify-center">
      <MarkerTip label={label} muted={open}>
        <button
          type="button"
          onClick={() => onOpen(thread.rootId)}
          aria-label={label}
          aria-expanded={open}
          style={{ width: MARKER_SIZE, height: MARKER_SIZE }}
          className={`flex items-center justify-center overflow-hidden rounded-full border bg-tip text-ink-dim hover:border-accent hover:text-ink ${markerEdge(thread, open)}`}
        >
          <MarkerFace thread={thread} />
        </button>
        <CommentCount count={thread.comments.length} />
      </MarkerTip>
    </div>
  );
}

// The open card shows this thread already; its tooltip would cover the card's byline.
function MarkerTip({ label, muted, children }: { label: string; muted: boolean; children: ReactNode }) {
  if (muted) return <span className="relative inline-flex">{children}</span>;
  return (
    <HoverCardTrigger label={label} focusable={false} tooltipStyle className="relative">
      {children}
    </HoverCardTrigger>
  );
}

function markerEdge(thread: ReviewThread, open: boolean): string {
  if (open) return 'border-accent text-ink';
  return `border-panel-edge ${thread.resolved ? 'opacity-60 hover:opacity-100' : ''}`;
}

function CommentCount({ count }: { count: number }) {
  if (count < 2) return null;
  return (
    <span aria-hidden className="absolute -bottom-px -right-px min-w-[9px] rounded-full bg-accent px-[2px] text-center text-[7px] leading-[9px] text-tooltip-ink">
      {count}
    </span>
  );
}

function MarkerFace({ thread }: { thread: ReviewThread }) {
  const first = thread.comments[0];
  if (!first) return <span className="text-[13px] leading-none">+</span>;
  return <AuthorPortrait avatarUrl={first.avatarUrl} className="h-full w-full" />;
}

function threadLabel(thread: ReviewThread): string {
  return thread.line === null ? 'Comment' : `Comment on line ${thread.line}`;
}

function markerLabel(thread: ReviewThread): string {
  const first = thread.comments[0];
  if (!first) return 'New comment';
  const state = thread.resolved ? 'resolved · ' : '';
  const more = thread.comments.length > 1 ? ` +${thread.comments.length - 1}` : '';
  return `${state}${first.author}${more}: ${snippet(first.body)}`;
}

function snippet(body: string): string {
  const line = body.trim().split('\n')[0] ?? '';
  return line.length > MAX_SNIPPET_CHARS ? `${line.slice(0, MAX_SNIPPET_CHARS)}…` : line;
}
