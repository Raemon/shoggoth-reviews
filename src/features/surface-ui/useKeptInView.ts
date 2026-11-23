'use client';

import { useEffect, useRef } from 'react';

const CONTEXT_ROWS = 3;

export function useKeptInView<T extends HTMLElement>(wanted: boolean) {
  const node = useRef<T>(null);
  useEffect(() => {
    if (wanted && node.current) nudgeIntoScroller(node.current);
  }, [wanted]);
  return node;
}

// scrollIntoView also scrolls the page, which would pull a stacked layout off the diff.
function nudgeIntoScroller(node: HTMLElement) {
  const scroller = scrollParentOf(node);
  if (!scroller) return;
  scroller.scrollTop += distanceToReveal(node.getBoundingClientRect(), scroller.getBoundingClientRect());
}

function distanceToReveal(box: DOMRect, frame: DOMRect): number {
  const context = Math.min(CONTEXT_ROWS * box.height, (frame.height - box.height) / 2);
  if (box.top < frame.top) return box.top - context - frame.top;
  if (box.bottom > frame.bottom) return box.bottom + context - frame.bottom;
  return 0;
}

function scrollParentOf(node: HTMLElement): HTMLElement | null {
  for (let at = node.parentElement; at; at = at.parentElement) {
    if (scrollsVertically(at)) return at;
  }
  return null;
}

function scrollsVertically(node: HTMLElement): boolean {
  return /auto|scroll/.test(getComputedStyle(node).overflowY);
}
