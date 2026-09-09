'use client';

import { Fragment, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref, type RefObject } from 'react';
import { NearViewportProvider } from './nearViewportStore';
import { DefinitionPeek } from './DefinitionPeek';
import { DefinitionPeekProvider } from './definitionPeekStore';
import { DiffAreaWidthProvider } from './diffAreaWidth';
import { DiffFileSection, type FileView } from './DiffFileSection';
import { DiffLayoutToggle } from './DiffLayoutToggle';
import type { FolderHeading } from './fileTreeNodes';
import { FolderHeadingBar } from './FolderHeading';
import { EditTarget } from './editTarget';
import { revealing, useFoldCommand, type FoldCommand } from './foldModeStore';
import { ImageThumbnailStrip } from './ImageThumbnailStrip';
import { imageFilesOf, isImagePath } from './imageFiles';
import type { ChangedFile, ChangedFileSet, PullRequestSummary } from './pullRequests';
import { WHOLE_FILE_STATUS } from './wholeFileEntry';
import { PaneStatusLine } from '@/features/surface-ui/PaneStatusLine';

const SCROLL_MS = 100;
const REALIGN_MS = 150;
const REALIGN_TRIES = 12;
const HAND_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;

interface ScrollTarget {
  node: HTMLElement;
  gap: number;
}

export interface DiffPanesHandle {
  scrollToFile: (path: string, rootId?: number) => void;
  toggleFile: (path: string) => void;
}

export function DiffPanes({
  owner,
  repo,
  fileSet,
  files,
  selected,
  editablePull = null,
  sortable = true,
  headings,
  onCommitted,
  ref,
}: {
  owner: string;
  repo: string;
  fileSet: ChangedFileSet | null;
  files: ChangedFile[];
  selected: string | null;
  editablePull?: PullRequestSummary | null;
  sortable?: boolean;
  headings?: ReadonlyMap<string, FolderHeading[]>;
  onCommitted?: () => void | Promise<void>;
  ref?: Ref<DiffPanesHandle>;
}) {
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const sections = useRef(new Map<string, HTMLElement>());
  const holdSection = useSectionRegistry(sections);
  const realigning = useRef<(() => void) | null>(null);
  useEffect(() => () => realigning.current?.(), []);
  const hold = useHeldScroll(scroller);
  const [fileFold, setFileFold] = useFileFold(() => hold(topVisibleHeader(scroller, files, sections.current)));
  const toggleFile = useCallback(
    (path: string) => {
      // The header is sticky: mid-file it, not the section top, is what the eye tracks.
      hold(headerOf(sections.current.get(path)));
      setFileFold((held) => withFileToggled(held, path));
    },
    [hold, setFileFold],
  );

  useImperativeHandle(ref, () => ({
    scrollToFile(path: string, rootId?: number) {
      const section = sections.current.get(path);
      if (!scroller || !section) return;
      realigning.current?.();
      animateScrollTop(scroller, scrollerOffset(scroller, section));
      realigning.current = realignAfterDrawing(scroller, () => scrollTarget(sections.current.get(path), rootId));
    },
    toggleFile,
  }));

  if (!fileSet) return <PaneStatusLine tone="dim" className="flex-1">Loading…</PaneStatusLine>;
  if (files.length === 0) return <PaneStatusLine tone="dim" className="flex-1">No files changed.</PaneStatusLine>;
  return (
    <EditTarget value={editablePull && { pull: editablePull, headRef: fileSet.headRef, onCommitted }}>
      <DefinitionPeekProvider owner={owner} repo={repo} fileSet={fileSet}>
        <div className="flex min-h-0 flex-1 flex-col">
          <DiffLayoutToggle sortable={sortable} hasDiffs={files.some((file) => file.status !== WHOLE_FILE_STATUS)} />
          <div ref={setScroller} className="min-h-0 flex-1 overflow-y-auto bg-code">
            <ImageStrip
              key={`${fileSet.baseRef}:${fileSet.headRef}`}
              owner={owner}
              repo={repo}
              fileSet={fileSet}
              files={imageFilesOf(files)}
            />
            <DiffAreaWidthProvider area={scroller}>
              <NearViewportProvider root={scroller}>
                {files.map((file) => (
                  <Fragment key={file.filename}>
                    {headings?.get(file.filename)?.map((heading) => <FolderHeadingBar key={heading.path} {...heading} />)}
                    <DiffFileSection
                      owner={owner}
                      repo={repo}
                      file={file}
                      baseRef={fileSet.baseRef}
                      headRef={fileSet.headRef}
                      selected={file.filename === selected}
                      view={fileView(fileFold, file.filename)}
                      onToggle={() => toggleFile(file.filename)}
                      sectionRef={holdSection(file.filename)}
                    />
                  </Fragment>
                ))}
              </NearViewportProvider>
            </DiffAreaWidthProvider>
          </div>
        </div>
        <DefinitionPeek />
      </DefinitionPeekProvider>
    </EditTarget>
  );
}

interface FileFold {
  command: FoldCommand;
  toggled: Record<string, boolean>;
}

// Applied from local state, not the store, so the reader can be held in place first.
function useFileFold(holdPlace: () => void) {
  const command = useFoldCommand();
  const held = useState<FileFold>(() => ({ command, toggled: {} }));
  const [fileFold, setFileFold] = held;
  const stale = fileFold.command.epoch !== command.epoch;
  useEffect(() => {
    if (!stale) return;
    holdPlace();
    setFileFold({ command, toggled: {} });
  }, [stale, command, holdPlace, setFileFold]);
  return held;
}

type HoldScroll = (anchor: Element | null) => void;

function useHeldScroll(scroller: HTMLElement | null): HoldScroll {
  const held = useRef<{ anchor: Element; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!held.current || !scroller) return;
    scroller.scrollTop += held.current.anchor.getBoundingClientRect().top - held.current.top;
    held.current = null;
  });
  return useCallback((anchor) => {
    held.current = anchor ? { anchor, top: anchor.getBoundingClientRect().top } : null;
  }, []);
}

function withFileToggled(held: FileFold, path: string): FileFold {
  return { ...held, toggled: { ...held.toggled, [path]: fileView(held, path) !== 'open' } };
}

function fileView(fold: FileFold, path: string): FileView {
  const forced = fold.toggled[path];
  if (forced === true) return 'open';
  const natural = naturalView(fold.command, path);
  if (forced === false && natural === 'open') return 'closed';
  return natural;
}

function naturalView(command: FoldCommand, path: string): FileView {
  if (isImagePath(path)) return 'closed';
  if (command.mode !== 'collapseFiles') return 'open';
  return revealing(command) ? 'revealed' : 'closed';
}

// Collapsing every file at once would fling the reader elsewhere; hold the one they are on.
function topVisibleHeader(container: HTMLElement | null, files: ChangedFile[], sections: Map<string, HTMLElement>): Element | null {
  if (!container) return null;
  const edge = container.getBoundingClientRect().top;
  const top = files.find((file) => reachesBelow(sections.get(file.filename), edge));
  return top ? headerOf(sections.get(top.filename)) : null;
}

function reachesBelow(section: HTMLElement | undefined, edge: number): boolean {
  return !!section && section.getBoundingClientRect().bottom > edge;
}

function headerOf(section: HTMLElement | undefined): Element | null {
  return section?.firstElementChild ?? null;
}

function ImageStrip({
  owner,
  repo,
  fileSet,
  files,
}: {
  owner: string;
  repo: string;
  fileSet: ChangedFileSet;
  files: ChangedFile[];
}) {
  if (files.length === 0) return null;
  return <ImageThumbnailStrip owner={owner} repo={repo} files={files} baseRef={fileSet.baseRef} headRef={fileSet.headRef} />;
}

// A thread card mounts only once its file draws, so the target is re-read each realign.
function scrollTarget(section: HTMLElement | undefined, rootId?: number): ScrollTarget | null {
  if (!section) return null;
  const card = rootId === undefined ? null : section.querySelector<HTMLElement>(`[data-thread-root="${rootId}"]`);
  return card ? { node: card, gap: headerHeight(section) } : { node: section, gap: 0 };
}

// Flush to the top a card would sit under the sticky header, so it stops that far short.
function headerHeight(section: HTMLElement): number {
  return section.firstElementChild?.getBoundingClientRect().height ?? 0;
}

function scrollerOffset(container: HTMLElement, section: HTMLElement): number {
  return container.scrollTop + section.getBoundingClientRect().top - container.getBoundingClientRect().top;
}

// A stable ref per file: a fresh one each render would re-run the section's observer.
function useSectionRegistry(sections: RefObject<Map<string, HTMLElement>>) {
  const held = useRef(new Map<string, (node: HTMLElement | null) => void>());
  return useCallback(
    (path: string) => held.current.get(path) ?? remember(held.current, path, sections.current),
    [sections],
  );
}

function remember(refs: Map<string, (node: HTMLElement | null) => void>, path: string, sections: Map<string, HTMLElement>) {
  const hold = (node: HTMLElement | null) => {
    if (node) sections.set(path, node);
    else sections.delete(path);
  };
  refs.set(path, hold);
  return hold;
}

// Files above the target draw as they near, moving it; hold it there until they settle.
function realignAfterDrawing(container: HTMLElement, section: () => ScrollTarget | null): () => void {
  let tries = 0;
  const stop = () => {
    clearInterval(settle);
    handEvents((type) => window.removeEventListener(type, stop, true));
  };
  const settle = setInterval(() => {
    const target = section();
    if (!target || (tries += 1) > REALIGN_TRIES) stop();
    else container.scrollTop = scrollerOffset(container, target.node) - target.gap;
  }, REALIGN_MS);
  handEvents((type) => window.addEventListener(type, stop, true));
  return stop;
}

// Scroll anchoring moves the scroller too, so only real input counts as taking over.
function handEvents(each: (type: (typeof HAND_EVENTS)[number]) => void) {
  for (const type of HAND_EVENTS) each(type);
}

function animateScrollTop(container: HTMLElement, target: number) {
  const start = container.scrollTop;
  const end = Math.max(0, Math.min(target, container.scrollHeight - container.clientHeight));
  const began = performance.now();
  const step = (now: number) => {
    const progress = Math.min(1, (now - began) / SCROLL_MS);
    const eased = 1 - (1 - progress) * (1 - progress);
    container.scrollTop = start + (end - start) * eased;
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
