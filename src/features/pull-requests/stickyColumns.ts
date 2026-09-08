'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { finiteNumber, recordPref, usePref } from './localPref';
import { clampWidth, type ColumnSize } from './ResizableColumn';

const DEFAULTS: Record<string, ColumnSize> = {
  pulls: { width: 300, open: false },
  'all-pulls': { width: 380, open: true },
  branches: { width: 300, open: false },
  discussion: { width: 320, open: false },
  commits: { width: 260, open: true },
  files: { width: 280, open: true },
  'all-files': { width: 280, open: false },
  'repo-files': { width: 320, open: true },
  'repo-pulls': { width: 360, open: true },
  'ai-chat': { width: 360, open: false },
};

const columnsPref = recordPref('reposcope.columns', decodeColumnSize);

export function setStickyColumn(name: string, next: SetStateAction<ColumnSize>, defaultOpen?: boolean): void {
  const held = columnsPref.read();
  const base = held[name] ?? defaultSize(name, defaultOpen);
  columnsPref.set({ ...held, [name]: typeof next === 'function' ? next(base) : next });
}

export function openStickyColumn(name: string): void {
  setStickyColumn(name, (size) => ({ ...size, open: true }));
}

export function useStickyColumn(name: string, defaultOpen?: boolean): [ColumnSize, Dispatch<SetStateAction<ColumnSize>>] {
  const size = usePref(columnsPref)[name] ?? defaultSize(name, defaultOpen);
  const remember = useCallback<Dispatch<SetStateAction<ColumnSize>>>((next) => setStickyColumn(name, next, defaultOpen), [name, defaultOpen]);
  return [size, remember];
}

export function useStickyOpen(name: string): [boolean, (open: boolean) => void] {
  const [size, setSize] = useStickyColumn(name);
  const setOpen = useCallback((open: boolean) => setSize((held) => ({ ...held, open })), [setSize]);
  return [size.open, setOpen];
}

function defaultSize(name: string, defaultOpen?: boolean): ColumnSize {
  const held = DEFAULTS[name] ?? { width: 300, open: true };
  return defaultOpen === undefined ? held : { ...held, open: defaultOpen };
}

function decodeColumnSize(size: unknown): ColumnSize | undefined {
  return isColumnSize(size) ? { width: clampWidth(size.width), open: size.open } : undefined;
}

function isColumnSize(size: unknown): size is ColumnSize {
  if (typeof size !== 'object' || size === null) return false;
  const { width, open } = size as { width?: unknown; open?: unknown };
  return finiteNumber(width) !== undefined && typeof open === 'boolean';
}
