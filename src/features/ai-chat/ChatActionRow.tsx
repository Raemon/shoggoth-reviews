'use client';

import { useState, type ReactNode } from 'react';
import { ActionIcon, ChevronIcon } from './chatActionIcons';
import type { ActionKind } from './chatActionMeta';

const ROW = 'px-1.5 opacity-50 hover:opacity-80';
const TOGGLE = 'flex w-full items-center gap-1.5 py-[3px] text-left text-[11px] leading-4 text-ink';

export function ChatActionRow({
  kind,
  summary,
  live = false,
  children,
}: {
  kind: ActionKind;
  summary: string;
  live?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={ROW}>
      <ActionToggle kind={kind} summary={summary} live={live} open={open} onToggle={() => setOpen(!open)} />
      {open && children}
    </div>
  );
}

function ActionToggle({
  kind,
  summary,
  live,
  open,
  onToggle,
}: {
  kind: ActionKind;
  summary: string;
  live: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button type="button" aria-expanded={open} onClick={onToggle} className={TOGGLE}>
      <LiveIcon kind={kind} live={live} />
      <span className="flex min-w-0 items-center gap-1">
        <span className="min-w-0 truncate">{summary}</span>
        <ChevronIcon open={open} />
      </span>
    </button>
  );
}

export function ActionDetail({ text }: { text: string }) {
  return <p className="whitespace-pre-wrap pb-1 pl-5 font-mono text-[10px] leading-4">{text.trim()}</p>;
}

function LiveIcon({ kind, live }: { kind: ActionKind; live: boolean }) {
  return (
    <span className={live ? 'shrink-0 animate-pulse' : 'shrink-0'}>
      <ActionIcon kind={kind} />
    </span>
  );
}
