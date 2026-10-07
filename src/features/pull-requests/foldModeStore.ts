'use client';

import { memoryPref, usePref } from './localPref';

export type FoldMode = 'default' | 'expandAll' | 'collapseExceptTypes' | 'collapseAll' | 'gitDefault';

export interface FoldCommand {
  mode: FoldMode;
  epoch: number;
  wholeFile: boolean;
}

const foldCommand = memoryPref<FoldCommand>({ mode: 'default', epoch: 0, wholeFile: true });

export function applyFoldMode(mode: FoldMode): void {
  const held = foldCommand.read();
  foldCommand.set({ mode, epoch: held.epoch + 1, wholeFile: wholeFileFor(mode) ?? held.wholeFile });
}

export function useFoldCommand(): FoldCommand {
  return usePref(foldCommand);
}

export function foldsCollapsed(mode: FoldMode): boolean {
  return mode !== 'expandAll' && mode !== 'gitDefault';
}

// Folds need the whole file, so every mode that collapses them loads it.
export function wholeFileFor(mode: FoldMode): boolean | null {
  if (mode === 'gitDefault') return false;
  return mode === 'expandAll' ? null : true;
}

export function wholeFileWanted(): boolean {
  return foldCommand.read().wholeFile;
}
