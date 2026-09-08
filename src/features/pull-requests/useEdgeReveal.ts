'use client';

import { useEffect, useRef, useState } from 'react';

export function useLeftEdgeReveal(zone: number, held: number): boolean {
  const [shown, setShown] = useState(false);
  const width = useRef(held);
  width.current = held;
  useEffect(() => {
    const threshold = (open: boolean) => (open ? Math.max(zone, width.current) : zone);
    const onMove = (event: PointerEvent) => setShown((open) => event.clientX <= threshold(open));
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [zone]);
  return shown;
}
