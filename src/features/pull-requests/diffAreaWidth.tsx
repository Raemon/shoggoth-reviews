'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useElementWidth } from './useElementWidth';

const DiffAreaWidthContext = createContext(0);

export function DiffAreaWidthProvider({ area, children }: { area: HTMLElement | null; children: ReactNode }) {
  return <DiffAreaWidthContext value={useElementWidth(area)}>{children}</DiffAreaWidthContext>;
}

export function useDiffAreaWidth(): number {
  return useContext(DiffAreaWidthContext);
}
