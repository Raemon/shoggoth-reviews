'use client';

import { useRef } from 'react';

export function useLastKnown<T>(value: T | null, scope: string): T | null {
  const last = useRef({ scope, value: null as T | null });
  if (last.current.scope !== scope) last.current = { scope, value: null };
  if (value !== null) last.current.value = value;
  return value ?? last.current.value;
}
