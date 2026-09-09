'use client';

import { memoryPref, usePref } from './localPref';

export type FoldMode = 'default' | 'expandAll' | 'collapseCode' | 'collapseFiles';

export type FoldReveal = 'comments' | 'types' | 'functions';

export interface FoldCommand {
  mode: FoldMode;
  reveals: ReadonlySet<FoldReveal>;
  search: string;
  epoch: number;
  wholeFile: boolean;
}

const foldCommand = memoryPref<FoldCommand>({ mode: 'default', reveals: new Set(), search: '', epoch: 0, wholeFile: true });

function advance(change: Partial<FoldCommand>): void {
  const held = foldCommand.read();
  foldCommand.set({ ...held, ...change, epoch: held.epoch + 1 });
}

export function applyFoldMode(mode: FoldMode): void {
  advance({ mode, wholeFile: wholeFileFor(mode) ?? foldCommand.read().wholeFile });
}

export function toggleFoldReveal(reveal: FoldReveal): void {
  const reveals = new Set(foldCommand.read().reveals);
  if (!reveals.delete(reveal)) reveals.add(reveal);
  advance({ reveals });
}

export function setFoldSearch(search: string): void {
  advance({ search });
}

export function useFoldCommand(): FoldCommand {
  return usePref(foldCommand);
}

export function foldsCollapsed(mode: FoldMode): boolean {
  return mode !== 'expandAll';
}

export function revealing(command: FoldCommand): boolean {
  return command.reveals.size > 0 || command.search !== '';
}

export function wholeFileFor(mode: FoldMode): boolean | null {
  return mode === 'default' ? true : null;
}

export function wholeFileWanted(): boolean {
  return foldCommand.read().wholeFile;
}
