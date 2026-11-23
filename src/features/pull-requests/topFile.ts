'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { onHandInput } from './handInput';
import type { ChangedFile } from './pullRequests';

type Sections = Map<string, HTMLElement>;

interface FileScroll {
  scroller: HTMLElement | null;
  files: ChangedFile[];
  sections: RefObject<Sections>;
  selected: string | null;
  onTopFile?: (path: string) => void;
}

export function topVisibleFile(container: HTMLElement, files: ChangedFile[], sections: Sections): ChangedFile | undefined {
  const edge = container.getBoundingClientRect().top;
  return files.find((file) => reachesBelow(sections.get(file.filename), edge));
}

function reachesBelow(section: HTMLElement | undefined, edge: number): boolean {
  return !!section && section.getBoundingClientRect().bottom > edge;
}

export function useTopFileReport({ scroller, files, sections, selected, onTopFile }: FileScroll): () => void {
  const [held, hold] = useHeldUntilHandInput();
  useEffect(() => {
    if (!scroller || !onTopFile) return;
    return onScroll(scroller, () => {
      const top = held.current ? undefined : topVisibleFile(scroller, files, sections.current);
      if (top && top.filename !== selected) onTopFile(top.filename);
    });
  }, [scroller, files, sections, selected, onTopFile, held]);
  return hold;
}

function onScroll(scroller: HTMLElement, heard: () => void): () => void {
  scroller.addEventListener('scroll', heard, { passive: true });
  return () => scroller.removeEventListener('scroll', heard);
}

// A reveal scrolls past other files, and its file may stop short of the top edge.
function useHeldUntilHandInput(): [RefObject<boolean>, () => void] {
  const held = useRef(false);
  useEffect(() => onHandInput(() => {
    held.current = false;
  }), []);
  const hold = () => {
    held.current = true;
  };
  return [held, hold];
}
