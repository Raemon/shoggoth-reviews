'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ColumnId } from './navColumn';
import { useViewMode } from './viewModeStore';

export type PaneFrame = 'pane' | 'preface';

export type PaneMode = 'hidden' | 'column' | 'reveal' | PaneFrame;

const CENTRAL_PANES: Partial<Record<ColumnId, PaneMode>> = {
  pulls: 'reveal',
  discussion: 'preface',
  commits: 'column',
  files: 'column',
  diff: 'column',
  'ai-chat': 'column',
};

export const PANE_MAX_WIDTH = 980;
export const PANE_WIDTH = 'mx-auto w-full max-w-[980px]';

interface CentralValue {
  central: boolean;
}

const CentralContext = createContext<CentralValue>({ central: false });

export function CentralLayoutProvider({ children }: { children: ReactNode }) {
  const central = useViewMode() === 'central';
  return <CentralContext.Provider value={{ central }}>{children}</CentralContext.Provider>;
}

export function useCentralLayout(): CentralValue {
  return useContext(CentralContext);
}

export function usePaneMode(id: ColumnId): PaneMode {
  return useCentralLayout().central ? CENTRAL_PANES[id] ?? 'hidden' : 'column';
}

export function useShowsColumn(id: ColumnId): boolean {
  return usePaneMode(id) !== 'hidden';
}
