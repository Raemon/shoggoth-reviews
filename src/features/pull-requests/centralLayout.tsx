'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { ColumnId } from './navColumn';
import { useViewMode } from './viewModeStore';

export type PaneFrame = 'pane' | 'preface';

export type PaneMode = 'hidden' | 'column' | 'reveal' | 'overlay' | PaneFrame;

const CENTRAL_PANES: Partial<Record<ColumnId, PaneMode>> = {
  pulls: 'reveal',
  discussion: 'preface',
  commits: 'column',
  files: 'column',
  diff: 'column',
};

export const PANE_WIDTH = 'mx-auto w-full max-w-[980px]';

const RAIL =
  'absolute inset-y-0 right-0 z-20 flex w-7 flex-col items-center justify-center gap-2.5 border-l border-panel-edge bg-panel py-2 text-[10px] uppercase tracking-[0.18em] text-ink-dim hover:bg-btn-hover hover:text-ink';

interface CentralValue {
  central: boolean;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
}

const CentralContext = createContext<CentralValue>({ central: false, chatOpen: false, setChatOpen: () => {} });

export function CentralLayoutProvider({ children }: { children: ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false);
  const central = useViewMode() === 'central';
  return <CentralContext.Provider value={{ central, chatOpen, setChatOpen }}>{children}</CentralContext.Provider>;
}

export function useCentralLayout(): CentralValue {
  return useContext(CentralContext);
}

export function usePaneMode(id: ColumnId): PaneMode {
  const { central, chatOpen } = useCentralLayout();
  if (!central) return 'column';
  if (id === 'ai-chat') return chatOpen ? 'overlay' : 'hidden';
  return CENTRAL_PANES[id] ?? 'hidden';
}

export function useShowsColumn(id: ColumnId): boolean {
  return usePaneMode(id) !== 'hidden';
}

export function CentralChatRail() {
  const { central, chatOpen, setChatOpen } = useCentralLayout();
  if (!central || chatOpen) return null;
  return (
    <button type="button" onClick={() => setChatOpen(true)} aria-label="Open AI chat" className={RAIL}>
      <span aria-hidden className="shrink-0 text-[11px] leading-none">✳</span>
      <span className="shrink-0 [writing-mode:vertical-rl]">ai chat</span>
    </button>
  );
}
