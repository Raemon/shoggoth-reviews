'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { overflowPast, placeThreads, type AnchoredThread, type PlacedThread } from './commentAnchors';
import { linesHeight, ROW_HEIGHT, type RowHeights } from './diffMetrics';
import type { DiffLine } from './diffLines';
import { rowLighting } from './litRow';
import { ThreadCard } from './ThreadCard';

const CARD_GAP = 4;
const EXPAND_BAR = 15;
// Keep in sync with the rendered height of a ThreadCard header row.
const CARD_HEADER = 22;
const MIN_SLOT = CARD_HEADER + EXPAND_BAR;

export function ThreadColumn({
  anchors,
  lines,
  heights: rowHeights,
  onOverflow,
}: {
  anchors: AnchoredThread[];
  lines: DiffLine[];
  heights: RowHeights;
  onOverflow: (pixels: number) => void;
}) {
  const [heights, setHeights] = useState<Record<number, number>>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const measure = useCallback((rootId: number, height: number) => {
    setHeights((held) => (held[rootId] === height ? held : { ...held, [rootId]: height }));
  }, []);
  const cards = placeThreads(anchors, heights, CARD_GAP, MIN_SLOT);
  const overflow = overflowBelow(cards, heights, expanded, linesHeight(lines, rowHeights));

  useEffect(() => onOverflow(overflow), [overflow, onOverflow]);

  return (
    <>
      {cards.map((card) => (
        <PlacedCard
          key={card.thread.rootId}
          row={card.row}
          top={card.top}
          clampTo={clampFor(card, heights)}
          expanded={expanded[card.thread.rootId] ?? false}
          onToggle={() => setExpanded((held) => ({ ...held, [card.thread.rootId]: !held[card.thread.rootId] }))}
          onHeight={(height) => measure(card.thread.rootId, height)}
        >
          <ThreadCard thread={card.thread} />
        </PlacedCard>
      ))}
    </>
  );
}

function clampFor(card: PlacedThread, heights: Record<number, number>): number | null {
  const natural = heights[card.thread.rootId] ?? ROW_HEIGHT;
  return natural > card.slot ? card.slot : null;
}

function shownHeight(card: PlacedThread, heights: Record<number, number>, expanded: Record<number, boolean>): number {
  const natural = heights[card.thread.rootId] ?? ROW_HEIGHT;
  const clampTo = clampFor(card, heights);
  if (clampTo === null) return natural;
  return expanded[card.thread.rootId] ? natural + EXPAND_BAR : clampTo;
}

function overflowBelow(
  cards: PlacedThread[],
  heights: Record<number, number>,
  expanded: Record<number, boolean>,
  diffHeight: number,
): number {
  return overflowPast(cards.map((card) => card.top + shownHeight(card, heights, expanded)), diffHeight);
}

function PlacedCard({
  row,
  top,
  clampTo,
  expanded,
  onToggle,
  onHeight,
  children,
}: {
  row: number;
  top: number;
  clampTo: number | null;
  expanded: boolean;
  onToggle: () => void;
  onHeight: (height: number) => void;
  children: ReactNode;
}) {
  const node = useRef<HTMLDivElement | null>(null);
  const latest = useRef(onHeight);
  latest.current = onHeight;

  useLayoutEffect(() => {
    const element = node.current;
    if (!element) return;
    const observer = new ResizeObserver(() => latest.current(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const clipped = clampTo !== null && !expanded;
  const overlaid = clampTo !== null && expanded;
  return (
    <div {...rowLighting(row)} style={{ top }} className={`absolute inset-x-0 px-1 transition-[top] duration-150 ${overlaid ? 'z-10' : ''}`}>
      <div className={clipped ? 'overflow-hidden' : undefined} style={clipped ? { maxHeight: clampTo - EXPAND_BAR } : undefined}>
        <div ref={node}>{children}</div>
      </div>
      {clampTo !== null && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse comment' : 'Expand comment'}
          style={{ height: EXPAND_BAR }}
          className="block w-full rounded-b border border-t-0 border-panel-edge bg-tip px-1.5 text-left text-[9px] italic leading-[13px] text-ink-dim hover:text-ink"
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      )}
    </div>
  );
}
