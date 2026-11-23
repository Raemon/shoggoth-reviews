'use client';

import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { onHandInput } from './handInput';
import type { ChangedFile } from './pullRequests';

type Sections = Map<string, HTMLElement>;

interface TopFileReport {
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

export function useTopFileReport({ scroller, files, sections, selected, onTopFile }: TopFileReport): () => void {
  const [paused, pause] = usePausedUntilHandInput();
  useEffect(() => {
    if (!scroller || !onTopFile) return;
    const topPath = () => topVisibleFile(scroller, files, sections.current)?.filename;
    return onScroll(scroller, () => {
      if (!paused.current) reportChange(topPath(), selected, onTopFile);
    });
  }, [scroller, files, sections, selected, onTopFile, paused]);
  return pause;
}

function reportChange(top: string | undefined, selected: string | null, onTopFile: (path: string) => void) {
  if (top !== undefined && top !== selected) onTopFile(top);
}

function onScroll(scroller: HTMLElement, heard: () => void): () => void {
  scroller.addEventListener('scroll', heard, { passive: true });
  return () => scroller.removeEventListener('scroll', heard);
}

// Our own scrolling passes other files, and a picked file may stop short of the top edge.
function usePausedUntilHandInput(): [RefObject<boolean>, () => void] {
  const paused = useRef(false);
  const resume = () => {
    paused.current = false;
  };
  useEffect(() => onHandInput(resume), []);
  const pause = useCallback(() => {
    paused.current = true;
  }, []);
  return [paused, pause];
}
