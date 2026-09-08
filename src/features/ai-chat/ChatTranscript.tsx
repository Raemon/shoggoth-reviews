'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import type { ChatEntry } from './chatEntries';
import { ChatActionRow, ActionDetail } from './ChatActionRow';
import { kindForTool, thinkingSummary, toolSummary } from './chatActionMeta';
import { UserBubble } from './UserBubble';
import { MarkdownBody } from '@/features/markdown/MarkdownBody';
import { renderMarkdown } from '@/features/markdown/renderMarkdown';

export function ChatTranscript({ entries, owner, repo, busy }: { entries: ChatEntry[]; owner: string; repo: string; busy: boolean }) {
  const foot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // scrollIntoView returns a Promise in Chrome; returning it makes React call it as cleanup
    foot.current?.scrollIntoView({ block: 'end' });
  }, [entries]);
  return (
    <div className="flex flex-col py-1">
      {entries.map((entry) => (
        <TranscriptEntry key={entry.id} entry={entry} owner={owner} repo={repo} />
      ))}
      {busy && <PendingDots />}
      <div ref={foot} />
    </div>
  );
}

function TranscriptEntry({ entry, owner, repo }: { entry: ChatEntry; owner: string; repo: string }) {
  if (entry.kind === 'user') return <UserBubble text={entry.text} />;
  if (entry.kind === 'assistant') return <AssistantEntry text={entry.text} owner={owner} repo={repo} />;
  if (entry.kind === 'thinking') return <ThinkingEntry text={entry.text} />;
  if (entry.kind === 'tool') return <ToolEntry name={entry.name} detail={entry.detail} done={entry.done} />;
  if (entry.kind === 'result') return <ResultEntry entry={entry} owner={owner} repo={repo} />;
  return <NoticeEntry kind={entry.kind} text={entry.text} />;
}

function AssistantEntry({ text, owner, repo }: { text: string; owner: string; repo: string }) {
  return <MarkdownEntry text={text} owner={owner} repo={repo} />;
}

function ThinkingEntry({ text }: { text: string }) {
  return (
    <ChatActionRow kind="thinking" summary={thinkingSummary(text)}>
      <ActionDetail text={text} />
    </ChatActionRow>
  );
}

function ToolEntry({ name, detail, done }: { name: string; detail: string; done: boolean }) {
  return (
    <ChatActionRow kind={kindForTool(name)} summary={toolSummary(name, detail)} live={!done}>
      <ActionDetail text={[name, detail].filter(Boolean).join('\n')} />
    </ChatActionRow>
  );
}

function NoticeEntry({ kind, text }: { kind: 'notice' | 'error'; text: string }) {
  return (
    <ChatActionRow kind={kind} summary={text}>
      <ActionDetail text={text} />
    </ChatActionRow>
  );
}

function ResultEntry({ entry, owner, repo }: { entry: Extract<ChatEntry, { kind: 'result' }>; owner: string; repo: string }) {
  return (
    <MarkdownEntry text={entry.text} owner={owner} repo={repo}>
      <ResultMeta branch={entry.branch} prUrl={entry.prUrl} />
    </MarkdownEntry>
  );
}

function ResultMeta({ branch, prUrl }: { branch: string | null; prUrl: string | null }) {
  return (
    <>
      {branch !== null && <p className="mt-0.5 font-mono text-[10px] text-ink-dim">pushed to {branch}</p>}
      {prUrl && (
        <a href={prUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] text-accent underline">
          open pull request
        </a>
      )}
    </>
  );
}

function MarkdownEntry({ text, owner, repo, children }: { text: string; owner: string; repo: string; children?: ReactNode }) {
  return (
    <article className="px-1.5 py-1.5">
      <MarkdownBody className="markdown-body break-words text-ink" html={renderMarkdown(text, { owner, repo })} tooltipStyle />
      {children}
    </article>
  );
}

function PendingDots() {
  return (
    <p aria-live="polite" className="animate-pulse px-1.5 py-1 text-[10px] tracking-[0.3em] text-ink-dim opacity-50">
      •••
    </p>
  );
}
