'use client';

import { useState } from 'react';
import { isDraftThread, type DraftAnchor } from './draftThread';
import { clearDraftThread, useDraftAnchor } from './draftThreadStore';
import { reviewCommentPath, reviewReactionPath, reviewReplyPath, reviewResolvePath } from './pullPaths';
import type { ReviewComment, ReviewThread } from './reviewThreads';
import { useReviewTarget, type ReviewThreadTarget } from './reviewThreadStore';
import { AuthorPortrait, COMMENT_ACTION, OpenOnGithub } from './CommentByline';
import { ThreadReplyBox } from './ThreadReplyBox';
import { useThreadAction } from './useThreadAction';
import { commentPreview } from './commentPreview';
import { renderMarkdown } from '@/features/markdown/renderMarkdown';
import { HoverCardTrigger } from '@/features/surface-ui/HoverCard';
import { MarkdownBody } from '@/features/markdown/MarkdownBody';
import { RelativeTime } from '@/features/surface-ui/RelativeTime';
import { useGithubToken } from '@/features/sources/sourceStore';
import { apiPost, apiPostJson } from '@/features/sources/apiClient';

const CARD = 'overflow-hidden rounded border border-panel-edge bg-tip shadow-card';

export function ThreadCard({ thread }: { thread: ReviewThread }) {
  if (isDraftThread(thread)) return <DraftThreadCard />;
  return <PostedThreadCard thread={thread} />;
}

function DraftThreadCard() {
  const anchor = useDraftAnchor();
  const target = useReviewTarget();
  const token = useGithubToken();
  const action = useThreadAction(() => clearThenReload(target));
  if (anchor === null) return null;
  return (
    <article className={CARD}>
      <header className="px-1.5 pt-[2px] text-[9px] leading-4 text-ink-dim">New comment · line {anchor.line}</header>
      <ThreadReplyBox
        key={`${anchor.side}:${anchor.line}`}
        busy={action.busy}
        placeholder="Comment…"
        onCancel={clearDraftThread}
        onSend={(body) => action.run(() => sendNewThread(anchor, body, token))}
      />
      <ActionFailure message={action.failure} />
    </article>
  );
}

// Clear before reloading: a failed reload must not re-offer an already posted comment.
function clearThenReload(target: ReviewThreadTarget): Promise<unknown> {
  clearDraftThread();
  return target.reload();
}

function ActionFailure({ message }: { message: string | null }) {
  if (message === null) return null;
  return <p className="px-1.5 pb-0.5 text-[9px] leading-3 text-error-ink">{message}</p>;
}

function PostedThreadCard({ thread }: { thread: ReviewThread }) {
  const target = useReviewTarget();
  const token = useGithubToken();
  const action = useThreadAction(target.reload);
  const [replying, setReplying] = useState(false);
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? !thread.resolved;
  const shown = open ? thread.comments : thread.comments.slice(0, 1);
  return (
    <article className={`group relative ${CARD} ${thread.resolved ? 'opacity-70 hover:opacity-100' : ''}`}>
      {shown.map((comment, index) => (
        <ThreadComment
          key={comment.id}
          comment={comment}
          note={index === 0 ? threadNote(thread, open) : ''}
          showBody={open}
          repo={target}
          onToggle={() => setToggled(!open)}
        />
      ))}
      {replying && (
        <ThreadReplyBox
          busy={action.busy}
          onCancel={() => setReplying(false)}
          onSend={(body) => {
            setReplying(false);
            action.run(() => sendReply(target, thread, body, token));
          }}
        />
      )}
      <ActionFailure message={action.failure} />
      {!replying && (
        <ThreadActions
          thread={thread}
          busy={action.busy}
          onReply={() => setReplying(true)}
          onReact={() => action.run(() => sendReaction(thread.comments[0], token))}
          onResolve={thread.threadId === null ? null : () => action.run(() => sendResolve(thread, token))}
        />
      )}
    </article>
  );
}

function threadNote(thread: ReviewThread, open: boolean): string {
  const hidden = open ? 0 : thread.comments.length - 1;
  return [thread.resolved ? 'resolved' : '', thread.outdated ? 'outdated' : '', hidden ? `+${hidden}` : '']
    .filter(Boolean)
    .join(' · ');
}

function ThreadComment({
  comment,
  note,
  showBody,
  repo,
  onToggle,
}: {
  comment: ReviewComment;
  note: string;
  showBody: boolean;
  repo: ReviewThreadTarget;
  onToggle: () => void;
}) {
  return (
    <div className="border-t border-panel-edge px-1.5 py-[2px] first:border-t-0">
      <header className="flex items-center gap-1 text-[9px] leading-4 text-ink-dim">
        <AuthorPortrait avatarUrl={comment.avatarUrl} />
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={showBody}
          className="min-w-0 shrink truncate text-left text-ink"
        >
          {comment.author}
        </button>
        {note && <span className="shrink-0">{note}</span>}
        <CommentPeek body={comment.body} bodyShown={showBody} />
        <RelativeTime iso={comment.createdAt} className="shrink-0" />
      </header>
      {showBody && (
        <MarkdownBody
          className="markdown-body break-words pr-6 text-ink"
          html={renderMarkdown(comment.body, repo)}
          tooltipStyle
        />
      )}
    </div>
  );
}

// ThreadColumn puts .peek on cards clipped to header height; without it this text stays hidden.
function CommentPeek({ body, bodyShown }: { body: string; bodyShown: boolean }) {
  return (
    <span className={`min-w-0 flex-1 truncate ${bodyShown ? 'invisible [.peek_&]:visible' : ''}`}>
      {commentPreview(body)}
    </span>
  );
}

function ThreadActions({
  thread,
  busy,
  onReply,
  onReact,
  onResolve,
}: {
  thread: ReviewThread;
  busy: boolean;
  onReply: () => void;
  onReact: () => void;
  onResolve: (() => void) | null;
}) {
  const first = thread.comments[0];
  return (
    <div className="absolute bottom-0 right-0 flex items-center gap-0.5 rounded-tl border-l border-t border-panel-edge bg-tip px-1 text-[10px] opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
      <HoverCardTrigger label="Reply" focusable={false} tooltipStyle>
        <button type="button" aria-label="Reply" onClick={onReply} disabled={busy} className={COMMENT_ACTION}>
          ↩
        </button>
      </HoverCardTrigger>
      <HoverCardTrigger label={first?.viewerReacted ? 'Remove 👍' : 'React 👍'} focusable={false} tooltipStyle>
        <button
          type="button"
          aria-label={first?.viewerReacted ? 'Remove thumbs up reaction' : 'Add thumbs up reaction'}
          onClick={onReact}
          disabled={busy}
          className={`${COMMENT_ACTION} ${first?.viewerReacted ? 'text-accent' : ''}`}
        >
          👍{first?.thumbsUp || ''}
        </button>
      </HoverCardTrigger>
      {onResolve && (
        <HoverCardTrigger label={thread.resolved ? 'Unresolve' : 'Resolve'} focusable={false} tooltipStyle>
          <button
            type="button"
            aria-label={thread.resolved ? 'Unresolve thread' : 'Resolve thread'}
            onClick={onResolve}
            disabled={busy}
            className={COMMENT_ACTION}
          >
            {thread.resolved ? '↺' : '✓'}
          </button>
        </HoverCardTrigger>
      )}
      <OpenOnGithub url={first?.url} />
    </div>
  );
}

function sendNewThread(anchor: DraftAnchor, body: string, token: string | null): Promise<unknown> {
  const { owner, repo, number, commitId, path, line, side } = anchor;
  return apiPostJson(reviewCommentPath(owner, repo, number), token, { body, commitId, path, line, side });
}

function sendReply(
  target: ReviewThreadTarget,
  thread: ReviewThread,
  body: string,
  token: string | null,
): Promise<unknown> {
  if (target.number === null) return Promise.reject(new Error('Replies need a pull request'));
  return apiPostJson(reviewReplyPath(target.owner, target.repo, target.number, thread.rootId), token, { body });
}

function sendResolve(thread: ReviewThread, token: string | null): Promise<unknown> {
  if (thread.threadId === null) return Promise.reject(new Error('Thread cannot be resolved'));
  return apiPost(reviewResolvePath(thread.threadId, !thread.resolved), token);
}

function sendReaction(comment: ReviewComment | undefined, token: string | null): Promise<unknown> {
  if (!comment) return Promise.reject(new Error('Nothing to react to'));
  return apiPost(reviewReactionPath(comment.nodeId, !comment.viewerReacted), token);
}
