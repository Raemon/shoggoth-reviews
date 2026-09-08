'use client';

import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { useDiffWidth } from './commentColumnWidth';
import { holdsFocus } from '@/features/surface-ui/focusables';

const CARD_WIDTH = 380;
const POPOVER_ATTR = 'data-thread-popover';

export const ANCHOR_ATTR = 'data-thread-anchor';

const KEEPS_OPEN = `[${POPOVER_ATTR}], [${ANCHOR_ATTR}]`;

export function ThreadPopover({
  top,
  label,
  dismissOnBlur,
  onDismiss,
  children,
}: {
  top: number;
  label: string;
  dismissOnBlur: boolean;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const card = useRef<HTMLDivElement>(null);
  const width = popoverWidth(useDiffWidth());
  useFocusOnOpen(card);
  useDismissal(onDismiss, dismissOnBlur);
  return (
    <div
      ref={card}
      {...{ [POPOVER_ATTR]: '' }}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      style={{ top, width }}
      className="absolute right-full z-10 pr-1 outline-none"
    >
      {children}
    </div>
  );
}

function popoverWidth(available: number): number {
  return available > 0 ? Math.min(CARD_WIDTH, available) : CARD_WIDTH;
}

// The draft composer autofocuses its textarea, so only an unfocused card takes focus.
function useFocusOnOpen(card: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const node = card.current;
    if (node && !holdsFocus(node)) node.focus();
  }, [card]);
}

function useDismissal(onDismiss: () => void, onBlur: boolean): void {
  const latest = useRef(onDismiss);
  latest.current = onDismiss;
  useEffect(() => {
    const away = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(KEEPS_OPEN)) latest.current();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') latest.current();
    };
    if (onBlur) window.addEventListener('pointerdown', away, true);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('pointerdown', away, true);
      window.removeEventListener('keydown', escape);
    };
  }, [onBlur]);
}
