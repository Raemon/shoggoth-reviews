'use client';

import { useEffect, useState } from 'react';

export function useDebounced<T>(value: T, delayMs: number): T {
  const [held, setHeld] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setHeld(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return held;
}
