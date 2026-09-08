'use client';

import { useEffect, useRef, useState } from 'react';

interface Spot {
  x: number;
  y: number;
}

export function useLeftEdgeReveal(zone: number, held: number, blockedSelector: string): boolean {
  const [shown, setShown] = useState(false);
  const at = useRef<Spot | null>(null);
  const reach = useRef(zone);
  reach.current = Math.max(zone, held);
  useEffect(() => {
    const settle = () => setShown((open) => revealedAt(at.current, open ? reach.current : zone, blockedSelector));
    return trackPointer(at, settle);
  }, [zone, blockedSelector]);
  return shown;
}

function revealedAt(spot: Spot | null, threshold: number, selector: string): boolean {
  if (spot === null || spot.x > threshold) return false;
  return document.elementFromPoint(spot.x, spot.y)?.closest(selector) == null;
}

function trackPointer(at: { current: Spot | null }, settle: () => void): () => void {
  const onMove = (event: PointerEvent) => {
    // A held button means a drag is running, so the panel stays as it is until it ends.
    if (event.buttons !== 0) return;
    at.current = { x: event.clientX, y: event.clientY };
    settle();
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('scroll', settle, true);
  return () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('scroll', settle, true);
  };
}
