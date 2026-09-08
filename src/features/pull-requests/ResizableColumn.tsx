'use client';

import { useCallback, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { PANE_WIDTH, usePaneMode, type PaneFrame } from './centralLayout';
import { useLeftEdgeReveal } from './useEdgeReveal';
import { columnHotkeyHint } from './columnCommands';
import { useColumnNav, type ColumnRow } from './columnNav';
import { COLUMN_HEADER, type ColumnId } from './navColumn';
import { HotkeyCap } from '@/features/hotkeys/HotkeyCap';
import { ColumnBoundary } from '@/features/surface-ui/ColumnBoundary';
import { SelectableRow } from '@/features/surface-ui/SelectableRow';

const HEADER_ROW = 'flex w-full shrink-0 items-center gap-1.5 border-panel-edge px-1.5 py-[1px] text-left';

const STRIP =
  'flex w-full shrink-0 cursor-pointer items-center gap-1.5 border-b px-1.5 py-1 text-[10px] uppercase tracking-[0.18em] text-ink-dim hover:text-ink md:w-7 md:min-h-0 md:flex-col md:gap-2.5 md:border-b-0 md:px-0';
// Buttons don't inherit text-transform, so the strip's uppercase repeats here.
const STRIP_EXPAND =
  'flex shrink-0 items-center gap-1.5 overflow-hidden rounded-[3px] uppercase outline-none focus-visible:ring-1 focus-visible:ring-accent md:max-h-[40%] md:flex-col md:gap-2.5';

const MIN_WIDTH = 140;
const MAX_WIDTH = 900;

export interface ColumnSize {
  width: number;
  open: boolean;
}

export function useCollapsibleColumn(id: ColumnId, size: ColumnSize, onSize: (next: ColumnSize) => void) {
  const fixed = usePaneMode(id) !== 'column';
  return {
    open: size.open || fixed,
    collapsible: !fixed,
    setOpen: (open: boolean) => onSize({ ...size, open }),
  };
}

export type DragEdge = 'left' | 'right';

export type ColumnSide = 'left' | 'right';

const OUTER_EDGE: Record<ColumnSide, string> = { left: 'md:border-r', right: 'md:border-l' };

export function useDragWidth(size: ColumnSize, onSize: (next: ColumnSize) => void, edge: DragEdge = 'right') {
  return useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = size.width;
      const move = (moved: PointerEvent) => {
        onSize({ width: clampWidth(startWidth + grownBy(moved.clientX - startX, edge)), open: true });
      };
      const stop = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', stop);
        window.removeEventListener('pointercancel', stop);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', stop);
      window.addEventListener('pointercancel', stop);
    },
    [size.width, onSize, edge],
  );
}

function grownBy(dragged: number, edge: DragEdge): number {
  return edge === 'left' ? -dragged : dragged;
}

export function DragHandle({
  onPointerDown,
  edge = 'right',
}: {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  edge?: DragEdge;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      role="separator"
      aria-orientation="vertical"
      className={`absolute inset-y-0 z-10 hidden w-[6px] cursor-col-resize hover:bg-btn-active md:block ${
        edge === 'left' ? '-left-[3px]' : '-right-[3px]'
      }`}
    />
  );
}

export function SectionHeader({
  icon,
  title,
  titleTone,
  note,
  hotkey,
  chevron,
  className,
  label,
  expanded,
  cursor,
  onPointerEnter,
  onActivate,
}: {
  icon: string;
  title: string;
  titleTone: string;
  note?: string;
  hotkey?: string;
  chevron: ReactNode;
  className: string;
  label: string;
  expanded?: boolean;
  cursor?: boolean;
  onPointerEnter?: () => void;
  onActivate: () => void;
}) {
  return (
    <SelectableRow
      cursor={cursor}
      onPointerEnter={onPointerEnter}
      onActivate={onActivate}
      label={label}
      expanded={expanded}
      className={`${HEADER_ROW} ${className}`}
    >
      <span aria-hidden className="shrink-0 text-[11px] leading-4 text-ink-dim">{icon}</span>
      <span className={`shrink-0 text-[10px] uppercase tracking-[0.18em] ${titleTone}`}>{title}</span>
      {note && <span className="min-w-0 flex-1 truncate text-[10px] text-ink-dim">{note}</span>}
      <span className="ml-auto flex shrink-0 items-center">
        {hotkey && <HotkeyCap hotkey={hotkey} hidden />}
        <span aria-hidden className="px-1 text-[14px] leading-none text-ink-dim">{chevron}</span>
      </span>
    </SelectableRow>
  );
}

function ColumnHeader({
  navId,
  title,
  icon,
  note,
  action,
  onCollapse,
}: {
  navId: ColumnId;
  title: string;
  icon: string;
  note?: string;
  action?: ReactNode;
  onCollapse: (() => void) | null;
}) {
  const nav = useColumnNav(navId);
  const row = nav.row(COLUMN_HEADER);
  return (
    <div className={`flex shrink-0 items-center ${headerTone(row, nav.focused)}`}>
      <SectionHeader
        {...row.props}
        icon={icon}
        title={title}
        titleTone={nav.focused ? 'text-accent' : 'text-ink-dim'}
        note={note}
        hotkey={columnHotkeyHint(navId)}
        chevron={onCollapse === null ? null : <span className="inline-block max-md:-rotate-90">‹</span>}
        className="min-w-0 flex-1"
        label={onCollapse === null ? title : `Collapse ${title}`}
        onActivate={onCollapse ?? (() => {})}
      />
      {action}
    </div>
  );
}

interface ColumnProps {
  navId: ColumnId;
  title: string;
  icon: string;
  note?: string;
  preview?: ReactNode;
  size: ColumnSize;
  onSize: (next: ColumnSize) => void;
  action?: ReactNode;
  footer?: ReactNode;
  tone?: string;
  side?: ColumnSide;
  children: ReactNode;
}

export function ResizableColumn(props: ColumnProps) {
  const pane = usePaneMode(props.navId);
  if (pane === 'hidden') return null;
  if (pane === 'column') return props.size.open ? <OpenColumn {...props} /> : <StripColumn {...props} />;
  if (pane === 'reveal') return <RevealColumn {...props} />;
  return <PaneColumn {...props} frame={pane} />;
}

const PANE_FRAME: Record<PaneFrame, { section: string; body: string; header: boolean }> = {
  pane: { section: 'min-h-0 flex-1', body: 'min-h-0 flex-1 overflow-auto', header: true },
  preface: { section: 'shrink-0', body: '', header: false },
};

function PaneColumn({ navId, title, icon, note, action, footer, frame, children }: ColumnProps & { frame: PaneFrame }) {
  const nav = useColumnNav(navId);
  return (
    <section
      data-nav-column={navId}
      onPointerDown={nav.focus}
      onPointerLeave={nav.clearHover}
      className={`flex min-w-0 flex-col bg-panel ${PANE_FRAME[frame].section}`}
    >
      {PANE_FRAME[frame].header && (
        <div className={`${PANE_WIDTH} shrink-0`}>
          <ColumnHeader navId={navId} title={title} icon={icon} note={note} action={action} onCollapse={null} />
        </div>
      )}
      <div ref={nav.bodyRef} className={PANE_FRAME[frame].body}>
        <div className={PANE_WIDTH}>
          <ColumnBoundary>{children}</ColumnBoundary>
        </div>
      </div>
      {footer}
    </section>
  );
}

const REVEAL_ZONE = 200;

// No visible handle in central mode: sweeping to the left page edge is what opens it.
function RevealColumn({ navId, size, onSize, footer, children }: ColumnProps) {
  const nearEdge = useLeftEdgeReveal(REVEAL_ZONE, size.width);
  const { focused, bodyRef, focus, clearHover } = useColumnNav(navId);
  const shown = nearEdge || focused;
  return (
    <section
      data-nav-column={navId}
      onPointerDown={focus}
      onPointerLeave={clearHover}
      inert={!shown}
      className={`absolute inset-y-0 left-0 z-40 flex w-[var(--col-w)] flex-col bg-panel transition-transform duration-150 ${
        shown ? 'translate-x-0' : '-translate-x-full'
      }`}
      style={{ '--col-w': `${size.width}px` } as CSSProperties}
    >
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-auto">
        <ColumnBoundary>{children}</ColumnBoundary>
      </div>
      {footer}
      <DragHandle onPointerDown={useDragWidth(size, onSize)} />
    </section>
  );
}

function StripColumn({ navId, title, icon, preview, size, onSize, side = 'left' }: ColumnProps) {
  const nav = useColumnNav(navId);
  return (
    // The whole strip expands on click; the button adds the label and keyboard access.
    <div
      data-nav-column={navId}
      onClick={() => onSize({ ...size, open: true })}
      onPointerDown={nav.focus}
      onPointerLeave={nav.clearHover}
      className={`${STRIP} ${OUTER_EDGE[side]} ${columnEdge(nav.focused)}`}
    >
      <button type="button" aria-label={`Expand ${title}`} className={STRIP_EXPAND}>
        <span aria-hidden className="shrink-0 text-[11px] leading-none">{icon}</span>
        <span className="shrink-0 md:[writing-mode:vertical-rl]">{title}</span>
      </button>
      {preview}
    </div>
  );
}

function OpenColumn({
  navId,
  title,
  icon,
  note,
  size,
  onSize,
  action,
  footer,
  tone = 'bg-panel',
  side = 'left',
  children,
}: ColumnProps) {
  const nav = useColumnNav(navId);
  const startDrag = useDragWidth(size, onSize);
  return (
    <section
      data-nav-column={navId}
      onPointerDown={nav.focus}
      onPointerLeave={nav.clearHover}
      className={`relative flex w-full shrink-0 flex-col border-b md:w-[var(--col-w)] md:min-h-0 md:border-b-0 ${OUTER_EDGE[side]} ${columnEdge(nav.focused, tone)}`}
      style={{ '--col-w': `${size.width}px` } as CSSProperties}
    >
      <ColumnHeader
        navId={navId}
        title={title}
        icon={icon}
        note={note}
        action={action}
        onCollapse={() => onSize({ ...size, open: false })}
      />
      <div ref={nav.bodyRef} className="max-h-[50vh] overflow-auto md:max-h-none md:min-h-0 md:flex-1">
        <ColumnBoundary>{children}</ColumnBoundary>
      </div>
      {footer}
      <DragHandle onPointerDown={startDrag} />
    </section>
  );
}

function columnEdge(focused: boolean, tone = 'bg-panel'): string {
  return focused ? 'border-accent/35 bg-btn' : `border-panel-edge ${tone}`;
}

function headerTone(row: ColumnRow, focused: boolean): string {
  return `border-b border-panel-edge ${headerFill(row, focused)}`;
}

function headerFill(row: ColumnRow, focused: boolean): string {
  if (row.state !== 'plain') return 'bg-btn-hover';
  return focused ? 'bg-btn' : 'bg-panel';
}

export function clampWidth(width: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
}
