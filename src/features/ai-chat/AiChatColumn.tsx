'use client';

import { ChatComposer } from './ChatComposer';
import { ChatTranscript } from './ChatTranscript';
import { CursorKeyForm } from './CursorKeyForm';
import { statusBusy, statusLabel } from './chatStatus';
import { useAiChat, type AiChat } from './useAiChat';
import { useCursorKey, writeCursorKey } from './cursorKeyStore';
import type { ChatSession } from './aiChatStore';
import { threadLabel, type ChatThread } from './chatThreads';
import { ColumnPreview, type PreviewToken } from '@/features/pull-requests/ColumnPreview';
import { useRegisterColumn } from '@/features/pull-requests/registerColumn';
import { usePaneMode } from '@/features/pull-requests/centralLayout';
import { useCollapsibleColumn, ResizableColumn } from '@/features/pull-requests/ResizableColumn';
import { useStickyColumn } from '@/features/pull-requests/stickyColumns';
import { SmallChoiceButton, SmallChoiceLink } from '@/features/surface-ui/SmallChoiceButton';

const ICON = '✳';
const HEADER_BTN = 'mr-1 shrink-0';
const PICKER = 'mr-1 max-w-32 shrink-0 truncate rounded bg-btn px-1 py-[1px] font-mono text-[9px] text-ink-dim hover:text-ink';

export function AiChatColumn({
  owner,
  repo,
  number,
  subject,
  headRef,
  headSha,
}: {
  owner: string;
  repo: string;
  number: number | null;
  subject: string;
  headRef: string | null;
  headSha: string | null;
}) {
  const [size, setSize] = useStickyColumn('ai-chat');
  const pane = usePaneMode('ai-chat');
  const key = useCursorKey();
  const chat = useAiChat({ subject, owner, repo, number, headRef, headSha, active: pane === 'pane' || size.open });
  const { session, account } = chat;
  useRegisterColumn('ai-chat', { ...useCollapsibleColumn('ai-chat', size, setSize), items: [], selected: null });
  return (
    <ResizableColumn
      navId="ai-chat"
      side="right"
      icon={ICON}
      title="ai chat"
      note={key === null ? 'needs key' : statusLabel(session)}
      preview={<ColumnPreview column="ai-chat" tokens={previewTokens(session, key)} />}
      size={size}
      onSize={setSize}
      action={key === null ? undefined : <HeaderActions chat={chat} />}
      footer={
        key === null ? null : (
          <ChatComposer
            busy={statusBusy(session)}
            disabled={account.error !== null}
            models={account.info?.models ?? []}
            model={chat.model}
            onModel={chat.restart}
            onSend={chat.send}
          />
        )
      }
    >
      {key === null ? (
        <CursorKeyForm error={account.error} />
      ) : (
        <>
          {account.error !== null && <p className="px-1.5 py-1 text-[10px] leading-4 text-error-ink">{account.error}</p>}
          <ChatTranscript entries={session.entries} owner={owner} repo={repo} busy={statusBusy(session)} />
        </>
      )}
    </ResizableColumn>
  );
}

function HeaderActions({ chat }: { chat: AiChat }) {
  const { session } = chat;
  return (
    <>
      <ThreadPicker threads={chat.threads} thread={chat.thread} onSelect={chat.select} />
      {session.agentUrl !== null && (
        <SmallChoiceLink href={session.agentUrl} target="_blank" rel="noopener noreferrer" className={`${HEADER_BTN} inline-block`}>
          cursor ↗
        </SmallChoiceLink>
      )}
      <SmallChoiceButton onClick={() => chat.restart(chat.model)} className={HEADER_BTN}>
        new
      </SmallChoiceButton>
      <SmallChoiceButton onClick={() => writeCursorKey(null)} className={HEADER_BTN}>
        key
      </SmallChoiceButton>
    </>
  );
}

function ThreadPicker({ threads, thread, onSelect }: { threads: ChatThread[]; thread: string | null; onSelect: (key: string) => void }) {
  if (threads.length < 2) return null;
  return (
    <select
      aria-label="Thread"
      value={thread ?? ''}
      onChange={(event) => onSelect(event.target.value)}
      className={PICKER}
    >
      {threads.map((held, index) => (
        <option key={held.key} value={held.key}>
          {threadLabel(held, index)}
        </option>
      ))}
    </select>
  );
}

function previewTokens(session: ChatSession, key: string | null): PreviewToken[] {
  if (key === null) return [{ key: 'ai-key', label: '⚿', title: 'Add a Cursor API key' }];
  if (statusBusy(session)) return [{ key: 'ai-busy', label: '◍', title: `Agent ${statusLabel(session)}` }];
  if (session.entries.length === 0) return [];
  return [{ key: 'ai-count', label: String(session.entries.length), title: 'Transcript entries' }];
}
