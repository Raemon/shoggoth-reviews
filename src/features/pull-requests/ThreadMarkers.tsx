'use client';

import { useEffect, useState } from 'react';
import { placeThreads, type AnchoredThread } from './commentAnchors';
import { MARKER_GAP, MARKER_SIZE } from './commentColumnWidth';
import { AuthorPortrait } from './CommentByline';
import { isDraftThread } from './draftThread';
import { clearDraftThread } from './draftThreadStore';
import { rowLighting } from './litRow';
import type { ReviewThread } from './reviewThreads';
import { ThreadCard } from './ThreadCard';
import { HoverCardTrigger } from '@/features/surface-ui/HoverCard';
import { ModalShell } from '@/features/surface-ui/ModalShell';

const MAX_SNIPPET_CHARS = 80;

export function ThreadMarkers({
  anchors,
  collapsed,
  onOverflow,
}: {
  anchors: AnchoredThread[];
  collapsed: boolean;
  onOverflow: (pixels: number) => void;
}) {
  const [picked, setPicked] = useState<ReviewThread | null>(null);
  const markers = collapsed ? [] : placeThreads(anchors, markerHeights(anchors), MARKER_GAP, MARKER_SIZE);
  const opened = anchors.find(({ thread }) => isDraftThread(thread))?.thread ?? picked;

  useEffect(() => onOverflow(0), [onOverflow]);

  return (
    <>
      {markers.map((marker) => (
        <MarkerButton key={marker.thread.rootId} row={marker.row} top={marker.top} thread={marker.thread} onOpen={setPicked} />
      ))}
      {opened && (
        <ModalShell label={threadLabel(opened)} dismissable onDismiss={() => dismissThread(setPicked)}>
          <ThreadCard thread={opened} />
        </ModalShell>
      )}
    </>
  );
}

function markerHeights(anchors: AnchoredThread[]): Record<number, number> {
  return Object.fromEntries(anchors.map(({ thread }) => [thread.rootId, MARKER_SIZE]));
}

function dismissThread(setPicked: (thread: ReviewThread | null) => void) {
  clearDraftThread();
  setPicked(null);
}

function MarkerButton({
  row,
  top,
  thread,
  onOpen,
}: {
  row: number;
  top: number;
  thread: ReviewThread;
  onOpen: (thread: ReviewThread) => void;
}) {
  const label = markerLabel(thread);
  return (
    <div {...rowLighting(row)} style={{ top }} className="absolute inset-x-0 flex justify-center">
      <HoverCardTrigger label={label} focusable={false} tooltipStyle className="relative">
        <button
          type="button"
          onClick={() => onOpen(thread)}
          aria-label={label}
          style={{ width: MARKER_SIZE, height: MARKER_SIZE }}
          className={`flex items-center justify-center overflow-hidden rounded-full border border-panel-edge bg-tip text-ink-dim hover:border-accent hover:text-ink ${thread.resolved ? 'opacity-60 hover:opacity-100' : ''}`}
        >
          <MarkerFace thread={thread} />
        </button>
        <CommentCount count={thread.comments.length} />
      </HoverCardTrigger>
    </div>
  );
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
