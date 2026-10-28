'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { codeSegments } from './codeSegments';
import type { PeekView } from './definitionContext';
import {
  useDefinitionPeekActions,
  useDefinitionPeekShown,
  type PeekAnchor,
  type PeekFrame,
  type PeekOrigin,
  type PeekSession,
} from './definitionPeekStore';
import type { DefinitionSite } from './definitionResolver';
import { unifiedLines, type DiffLine } from './diffLines';
import { lineTone } from './DiffSide';
import { originAtPoint } from './useDefinitionPointer';
import { useDiffTokens } from './useDiffSideHighlight';
import { TEXT_ACTION } from '@/features/surface-ui/buttonStyles';

export function DefinitionPeek() {
  const shown = useDefinitionPeekShown();
  if (!shown?.session) return null;
  return createPortal(<PeekPanel session={shown.session} />, document.body);
}

function PeekPanel({ session }: { session: PeekSession }) {
  const actions = useDefinitionPeekActions();
  const panel = useRef<HTMLDivElement | null>(null);
  const frame = session.frames[session.frames.length - 1];
  const reachable = useReachable(session);
  useDismiss(panel, actions?.close, session.pinned);
  useWordHighlight(session.anchor.range);
  if (!actions || !frame) return null;
  return (
    <div
      ref={panel}
      className={`fixed z-50 flex w-[680px] max-w-[92vw] flex-col overflow-hidden rounded border border-panel-edge bg-panel shadow-card ${reachable ? '' : 'pointer-events-none'}`}
      style={panelPlacement(session.anchor)}
      onMouseEnter={actions.hold}
      onMouseLeave={actions.release}
    >
      <PeekHeader frame={frame} depth={session.frames.length} onBack={actions.back} onClose={actions.close} />
      {frame.sites.length > 1 && <CandidateRow frame={frame} onPick={(site) => actions.pick(site, frame)} />}
      <PeekBody frame={frame} onPush={actions.push} />
    </div>
  );
}

const REACHABLE_AFTER_MS = 300;
const WORD_HIGHLIGHT = 'definition-peek-word';

// Until then the panel lets the pointer through, so moving onto it leaves the word.
function useReachable(session: PeekSession): boolean {
  const [heldAnchor, setHeldAnchor] = useState<PeekAnchor | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setHeldAnchor(session.anchor), REACHABLE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [session.anchor]);
  return session.pinned || heldAnchor === session.anchor;
}

function useWordHighlight(word: Range) {
  useLayoutEffect(() => {
    if (!('highlights' in CSS)) return;
    CSS.highlights.set(WORD_HIGHLIGHT, new Highlight(word));
    return () => void CSS.highlights.delete(WORD_HIGHLIGHT);
  }, [word]);
}

function useDismiss(panel: React.RefObject<HTMLDivElement | null>, close: (() => void) | undefined, pinned: boolean) {
  useEffect(() => {
    if (!close) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close();
    const outside = (event: Event) => panel.current !== null && !panel.current.contains(event.target as Node);
    const onPress = (event: PointerEvent) => pinned && outside(event) && close();
    const onScroll = (event: Event) => outside(event) && close();
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPress);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPress);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [panel, close, pinned]);
}

const PANEL_GAP = 1;
const MIN_BELOW = 280;
const MAX_PANEL_HEIGHT = 420;
const VIEWPORT_PAD = 16;

function panelPlacement(anchor: PeekAnchor): CSSProperties {
  const width = Math.min(680, window.innerWidth * 0.92);
  const left = Math.min(Math.max(8, anchor.left - 12), window.innerWidth - width - 8);
  const below = window.innerHeight - anchor.bottom;
  const above = window.innerHeight - anchor.top;
  if (below > MIN_BELOW) return { left, top: anchor.bottom + PANEL_GAP, maxHeight: Math.min(MAX_PANEL_HEIGHT, below - VIEWPORT_PAD) };
  return { left, bottom: above + PANEL_GAP, maxHeight: Math.min(MAX_PANEL_HEIGHT, anchor.top - VIEWPORT_PAD) };
}

function PeekHeader({
  frame,
  depth,
  onBack,
  onClose,
}: {
  frame: PeekFrame;
  depth: number;
  onBack: () => void;
  onClose: () => void;
}) {
  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-panel-edge px-2 py-1 text-[11px] text-ink">
      {depth > 1 && <HeaderButton label="Back" onClick={onBack} text="‹" />}
      <span className="filename-text min-w-0 flex-1 truncate">
        <span className="text-ink-dim">{frame.word} · </span>
        {frame.site ? `${frame.site.path}:${frame.site.nameLine}` : '…'}
      </span>
      {frame.view?.changedInPull && (
        <span className="shrink-0 rounded bg-add-bg px-1 text-[9px] uppercase tracking-[0.14em] text-add-ink">changed here</span>
      )}
      <HeaderButton label="Close definition peek" onClick={onClose} text="×" />
    </header>
  );
}

function HeaderButton({ label, onClick, text }: { label: string; onClick: () => void; text: string }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className={`${TEXT_ACTION} shrink-0 px-1`}>
      {text}
    </button>
  );
}

function CandidateRow({ frame, onPick }: { frame: PeekFrame; onPick: (site: DefinitionSite) => void }) {
  return (
    <div className="flex shrink-0 flex-wrap gap-1 border-b border-panel-edge px-2 py-1 text-[9px]">
      {frame.sites.map((site) => (
        <button
          key={`${site.ref}:${site.path}:${site.nameLine}`}
          type="button"
          onClick={() => onPick(site)}
          className={`${sameSite(site, frame.site) ? 'rounded bg-btn-hover text-ink' : TEXT_ACTION} px-1`}
        >
          {site.path}:{site.nameLine}
        </button>
      ))}
    </div>
  );
}

function sameSite(a: DefinitionSite, b: DefinitionSite | null): boolean {
  return b !== null && a.path === b.path && a.nameLine === b.nameLine && a.ref === b.ref;
}

function PeekBody({ frame, onPush }: { frame: PeekFrame; onPush: (origin: PeekOrigin) => void }) {
  if (frame.loading) return <PeekNote text={`resolving ${frame.word}…`} />;
  if (!frame.view) return <PeekNote text={frame.note ?? 'no definition found'} />;
  return <PeekCode view={frame.view} path={frame.site?.path ?? ''} onPush={onPush} />;
}

function PeekNote({ text }: { text: string }) {
  return <p className="px-2 py-2 font-sans text-[11px] text-ink-dim">{text}</p>;
}

function PeekCode({ view, path, onPush }: { view: PeekView; path: string; onPush: (origin: PeekOrigin) => void }) {
  const tokens = useDiffTokens(view.rows, path);
  const lines = useMemo(() => unifiedLines(view.rows), [view.rows]);
  return (
    <div className="min-h-0 overflow-auto bg-code py-1">
      {lines.map((line, at) => (
        <PeekLine
          key={at}
          line={line}
          tokens={line.cell ? tokens?.[line.side][line.row] ?? null : null}
          onPress={(event) => {
            if (event.detail !== 1) return;
            const pointed = originAtPoint(view.sides, line, event);
            if (pointed) onPush(pointed.origin);
          }}
        />
      ))}
      {view.truncated && <p className="px-2 font-sans text-[9px] italic text-ink-dim">… truncated</p>}
    </div>
  );
}

function PeekLine({
  line,
  tokens,
  onPress,
}: {
  line: DiffLine;
  tokens: Parameters<typeof codeSegments>[1];
  onPress: (event: MouseEvent<HTMLElement>) => void;
}) {
  const cell = line.cell;
  if (line.kind === 'hunk' || !cell) return null;
  return (
    <div className={`flex h-[15px] items-center gap-1 leading-[15px] ${lineTone(line.side, line.kind === 'change')}`}>
      <span className="w-[38px] shrink-0 select-none text-right text-[9px] text-ink-dim">{cell.line}</span>
      <span className="diff-code whitespace-pre pr-2 text-[11px]" onClick={onPress}>
        {codeSegments(cell.text, tokens, null).map((segment, at) => (
          <span key={at} style={segment.style}>
            {segment.content}
          </span>
        ))}
      </span>
    </div>
  );
}
