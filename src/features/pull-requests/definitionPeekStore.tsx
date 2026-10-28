'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createFrameCache, loadingFrame, originKey, type FrameCache, type PeekFrame, type PeekOrigin } from './definitionFrames';
import { patchOrigins, preloadDefinitions } from './definitionPreload';
import type { DefinitionSite } from './definitionResolver';
import type { ChangedFileSet } from './pullRequests';
import { useResolverFiles, type TrimmableFiles } from './resolverFiles';

export type { PeekFrame, PeekOrigin } from './definitionFrames';

export interface PeekAnchor {
  left: number;
  top: number;
  bottom: number;
  range: Range;
}

export interface PeekSession {
  anchor: PeekAnchor;
  frames: PeekFrame[];
  pinned: boolean;
}

export interface PeekActions {
  open(origin: PeekOrigin, anchor: PeekAnchor): void;
  hover(origin: PeekOrigin, anchor: PeekAnchor): void;
  unhover(): void;
  hold(): void;
  release(): void;
  push(origin: PeekOrigin): void;
  pick(site: DefinitionSite, from: PeekFrame): void;
  back(): void;
  close(): void;
}

export interface PeekShown {
  session: PeekSession | null;
  fileSet: ChangedFileSet | null;
}

const PeekActionsContext = createContext<PeekActions | null>(null);
const PeekShownContext = createContext<PeekShown | null>(null);

export function useDefinitionPeekActions(): PeekActions | null {
  return useContext(PeekActionsContext);
}

export function useDefinitionPeekShown(): PeekShown | null {
  return useContext(PeekShownContext);
}

export function DefinitionPeekProvider({
  owner,
  repo,
  fileSet,
  children,
}: {
  owner: string;
  repo: string;
  fileSet: ChangedFileSet | null;
  children: ReactNode;
}) {
  const [session, setSession] = useState<PeekSession | null>(null);
  const files = useResolverFiles(owner, repo);
  const frames = useFrameCache(files, fileSet);
  const actions = useMemo(() => createPeekActions(frames, setSession), [frames]);
  const shown = useMemo(() => ({ session, fileSet }), [session, fileSet]);
  return (
    <PeekActionsContext value={actions}>
      <PeekShownContext value={shown}>{children}</PeekShownContext>
    </PeekActionsContext>
  );
}

type FileSetRef = { current: ChangedFileSet | null };

function useFrameCache(files: TrimmableFiles, fileSet: ChangedFileSet | null): FrameCache {
  const fileSetRef = useRef(fileSet);
  fileSetRef.current = fileSet;
  const refs = fileSet ? `${fileSet.baseRef}\0${fileSet.headRef}` : null;
  const frames = useHeldFrameCache(files, refs, fileSetRef);
  usePreload(frames, files, refs, fileSetRef);
  return frames;
}

interface HeldCache {
  refs: string | null;
  files: TrimmableFiles;
  frames: FrameCache;
}

function useHeldFrameCache(files: TrimmableFiles, refs: string | null, fileSetRef: FileSetRef): FrameCache {
  const held = useRef<HeldCache | null>(null);
  if (!held.current || held.current.refs !== refs || held.current.files !== files) {
    held.current = { refs, files, frames: createFrameCache(files, fileSetRef) };
  }
  return held.current.frames;
}

function usePreload(frames: FrameCache, files: TrimmableFiles, refs: string | null, fileSetRef: FileSetRef) {
  useEffect(() => {
    if (!fileSetRef.current || refs === null) return;
    return preloadDefinitions(patchOrigins(fileSetRef.current), warmUnlessLarge(frames, files), files.trimParsed);
  }, [frames, files, refs, fileSetRef]);
}

// Parsing a large file stalls the page: too high a price for a guess at what's hovered.
function warmUnlessLarge(frames: FrameCache, files: TrimmableFiles) {
  return async (origin: PeekOrigin) => {
    if (await files.preloadable(origin.ref, origin.path)) await frames.warm(origin);
  };
}

type SessionUpdate = (held: PeekSession | null) => PeekSession | null;
type SetSession = (update: SessionUpdate) => void;

interface HoverState {
  hovering: string | null;
  shownKey: string | null;
  pinned: boolean;
  hideTimer?: ReturnType<typeof setTimeout>;
}

function createPeekActions(frames: FrameCache, setSession: SetSession): PeekActions {
  const state: HoverState = { hovering: null, shownKey: null, pinned: false };
  const session = sessionControls(state, setSession);
  const pinned = pinActions(frames, state, session, setSession);
  const hovered = hoverActions(frames, state, session);
  return { ...pinned, ...hovered, release: hovered.unhover, close: session.hide };
}

interface SessionControls {
  settle(loading: Promise<PeekFrame>, wanted: number): void;
  next(): number;
  show(key: string, anchor: PeekAnchor, frame: PeekFrame): void;
  hide(): void;
}

function sessionControls(state: HoverState, setSession: SetSession): SessionControls {
  let generation = 0;
  const next = () => ++generation;
  const settle = (loading: Promise<PeekFrame>, wanted: number) => {
    void loading.then((frame) => wanted === generation && setSession(withTopReplaced(frame)));
  };
  const show = (key: string, anchor: PeekAnchor, frame: PeekFrame) => {
    next();
    Object.assign(state, { shownKey: key, pinned: false });
    setSession(() => ({ anchor, frames: [frame], pinned: false }));
  };
  const hide = () => {
    next();
    clearTimeout(state.hideTimer);
    Object.assign(state, { shownKey: null, pinned: false });
    setSession(() => null);
  };
  return { settle, next, show, hide };
}

function pinActions(frames: FrameCache, state: HoverState, session: SessionControls, setSession: SetSession) {
  const pinOrigin = (origin: PeekOrigin, place: (frame: PeekFrame) => SessionUpdate) => {
    const wanted = session.next();
    state.pinned = true;
    const known = frames.settled(origin);
    setSession(place(known ?? loadingFrame(origin.word)));
    if (!known) session.settle(frames.frameFor(origin), wanted);
  };
  const open = (origin: PeekOrigin, anchor: PeekAnchor) => {
    clearTimeout(state.hideTimer);
    state.shownKey = originKey(origin);
    pinOrigin(origin, (frame) => () => ({ anchor, frames: [frame], pinned: true }));
  };
  const push = (origin: PeekOrigin) => pinOrigin(origin, withPushed);
  const pick = (site: DefinitionSite, from: PeekFrame) => {
    const wanted = session.next();
    state.pinned = true;
    setSession(withTopReplaced({ ...from, loading: true }, true));
    session.settle(frames.siteFrame(site, from.sites, from.word), wanted);
  };
  const back = () => {
    session.next();
    setSession(withPopped);
  };
  return { open, push, pick, back };
}

function hoverActions(frames: FrameCache, state: HoverState, session: SessionControls) {
  // Deferred a tick so entering the panel, or returning from it to the word, can cancel it.
  const scheduleHide = () => {
    clearTimeout(state.hideTimer);
    state.hideTimer = setTimeout(session.hide);
  };
  const reveal = (origin: PeekOrigin, anchor: PeekAnchor, key: string) => {
    const present = (frame: PeekFrame) => frame.view && session.show(key, anchor, frame);
    const known = frames.settled(origin);
    if (known) return present(known);
    void frames.frameFor(origin).then((frame) => state.hovering === key && !state.pinned && present(frame));
  };
  const hover = (origin: PeekOrigin, anchor: PeekAnchor) => {
    const key = originKey(origin);
    if (key === state.hovering) return;
    state.hovering = key;
    clearTimeout(state.hideTimer);
    if (state.pinned || key === state.shownKey) return;
    if (state.shownKey !== null) session.hide();
    reveal(origin, anchor, key);
  };
  const unhover = () => {
    state.hovering = null;
    if (!state.pinned && state.shownKey !== null) scheduleHide();
  };
  const hold = () => {
    state.hovering = null;
    clearTimeout(state.hideTimer);
  };
  return { hover, unhover, hold };
}

function withTopReplaced(frame: PeekFrame, pinned?: boolean): SessionUpdate {
  return (held) => held && { ...held, pinned: pinned ?? held.pinned, frames: [...held.frames.slice(0, -1), frame] };
}

function withPushed(frame: PeekFrame): SessionUpdate {
  return (held) => held && { ...held, pinned: true, frames: [...held.frames, frame] };
}

function withPopped(held: PeekSession | null): PeekSession | null {
  return held && held.frames.length > 1 ? { ...held, frames: held.frames.slice(0, -1) } : held;
}
