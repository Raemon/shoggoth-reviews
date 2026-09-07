'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChatEntry } from './chatEntries';
import { MarkdownBody } from '@/features/markdown/MarkdownBody';
import { renderMarkdown } from '@/features/markdown/renderMarkdown';

const ROW = 'border-b border-panel-edge px-1.5 py-1';
const LABEL = 'text-[9px] uppercase tracking-[0.18em] text-ink-dim';

export function ChatTranscript({ entries, owner, repo, busy }: { entries: ChatEntry[]; owner: string; repo: string; busy: boolean }) {
  const foot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // scrollIntoView returns a Promise in Chrome; returning it makes React call it as cleanup
    foot.current?.scrollIntoView({ block: 'end' });
  }, [entries]);
  return (
    <div className="flex flex-col">
      {entries.map((entry) => (
        <TranscriptEntry key={entry.id} entry={entry} owner={owner} repo={repo} />
      ))}
      {busy && <PendingDots />}
      <div ref={foot} />
    </div>
  );
}

function TranscriptEntry({ entry, owner, repo }: { entry: ChatEntry; owner: string; repo: string }) {
  if (entry.kind === 'user') return <UserEntry text={entry.text} />;
  if (entry.kind === 'assistant') return <AssistantEntry text={entry.text} owner={owner} repo={repo} />;
  if (entry.kind === 'thinking') return <ThinkingEntry text={entry.text} />;
  if (entry.kind === 'tool') return <ToolEntry name={entry.name} detail={entry.detail} done={entry.done} />;
  if (entry.kind === 'result') return <ResultEntry entry={entry} owner={owner} repo={repo} />;
  return <p className={`${ROW} text-[10px] leading-4 ${entry.kind === 'error' ? 'text-error-ink' : 'text-ink-dim'}`}>{entry.text}</p>;
}

function UserEntry({ text }: { text: string }) {
  return (
    <article className={`${ROW} bg-field`}>
      <p className={LABEL}>you</p>
      <p className="whitespace-pre-wrap font-serif text-[13px] leading-[1.5] text-ink">{text}</p>
    </article>
  );
}

function AssistantEntry({ text, owner, repo }: { text: string; owner: string; repo: string }) {
  return (
    <article className={ROW}>
      <MarkdownBody className="markdown-body break-words text-ink" html={renderMarkdown(text, { owner, repo })} tooltipStyle />
    </article>
  );
}

function ThinkingEntry({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${ROW} bg-shade/60`}>
      <button type="button" onClick={() => setOpen(!open)} className={`${LABEL} flex w-full items-center gap-1 hover:text-ink`}>
        <span aria-hidden>{open ? '▾' : '▸'}</span>
        thinking
        {!open && <span className="min-w-0 flex-1 truncate normal-case tracking-normal">{text.trim()}</span>}
      </button>
      {open && <p className="whitespace-pre-wrap font-mono text-[10px] leading-4 text-ink-dim">{text.trim()}</p>}
    </div>
  );
}

function ToolEntry({ name, detail, done }: { name: string; detail: string; done: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5 px-1.5 py-[2px] font-mono text-[10px] text-ink-dim">
      <span aria-hidden className={done ? 'text-scope' : 'animate-pulse text-accent'}>{done ? '✓' : '◍'}</span>
      <span className="shrink-0 text-ink">{name}</span>
      <span className="min-w-0 flex-1 truncate">{detail}</span>
    </div>
  );
}

function ResultEntry({ entry, owner, repo }: { entry: Extract<ChatEntry, { kind: 'result' }>; owner: string; repo: string }) {
  return (
    <article className={`${ROW} border-l-2 border-l-scope`}>
      <p className={LABEL}>result</p>
      <MarkdownBody className="markdown-body break-words text-ink" html={renderMarkdown(entry.text, { owner, repo })} tooltipStyle />
      {entry.branch !== null && <p className="mt-0.5 font-mono text-[10px] text-ink-dim">pushed to {entry.branch}</p>}
      {entry.prUrl && (
        <a href={entry.prUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] text-accent underline">
          open pull request
        </a>
      )}
    </article>
  );
}

function PendingDots() {
  return (
    <p aria-live="polite" className="animate-pulse px-1.5 py-1 text-[10px] tracking-[0.3em] text-ink-dim">
      •••
    </p>
  );
}
