'use client';

import { pullCommentsPath, pullUrl } from './pullPaths';
import { AuthorPortrait, OpenOnGithub } from './CommentByline';
import { useCentralLayout } from './centralLayout';
import { StateTags } from './PullListRow';
import { commentPreview } from './commentPreview';
import { renderMarkdown } from '@/features/markdown/renderMarkdown';
import type { PullComment, PullRequestSummary } from './pullRequests';
import { useGithubToken, useStoreReady } from '@/features/sources/sourceStore';
import { MarkdownBody } from '@/features/markdown/MarkdownBody';
import { RelativeTime } from '@/features/surface-ui/RelativeTime';
import { useCachedJson } from '@/features/sources/useCachedJson';
import { useIsOwnAuthor } from '@/features/github-auth/useViewerLogin';
import { usePollWhileVisible } from '@/features/sources/usePollWhileVisible';

const READING_WIDTH = 'max-w-[720px]';
const ENTRY_CARD = 'mb-1.5 rounded border border-panel-edge bg-tip px-1.5 py-1 shadow-card';
// inline-entry names itself so consecutive rows drop the doubled border between them.
const INLINE_ROW =
  'inline-entry flex items-center gap-1.5 border-y border-panel-edge px-1.5 text-[9px] leading-5 text-ink-dim [.inline-entry+&]:border-t-0';

export function PullDiscussion({
  owner,
  repo,
  number,
  pull,
  body,
}: {
  owner: string;
  repo: string;
  number: number;
  pull: PullRequestSummary;
  body: string | null;
}) {
  const ready = useStoreReady();
  const token = useGithubToken();
  const commentState = useCachedJson<PullComment[]>(pullCommentsPath(owner, repo, number), token, ready);
  const { data: comments, error } = commentState;

  usePollWhileVisible(commentState.reload, ready);

  return (
    <div className="flex flex-col">
      <SubjectHeading number={number} pull={pull} url={pullUrl(owner, repo, number)} />
      <DiscussionEntry
        owner={owner}
        repo={repo}
        author={pull.author}
        url={pullUrl(owner, repo, number)}
        body={body?.trim() ? body : 'No description.'}
        bodyWidth={READING_WIDTH}
      />
      {comments === null ? (
        <p className={`px-1.5 py-1 text-[11px] leading-4 ${error ? 'text-error-ink' : 'text-ink-dim'}`}>
          {error ?? 'Loading comments…'}
        </p>
      ) : comments.length === 0 ? (
        <p className="px-1.5 py-1 text-[11px] leading-4 text-ink-dim">No comments.</p>
      ) : (
        comments.map((comment) => (
          <DiscussionEntry
            key={comment.id}
            owner={owner}
            repo={repo}
            author={comment.author}
            avatarUrl={comment.avatarUrl}
            createdAt={comment.createdAt}
            path={comment.path}
            url={comment.url}
            body={comment.body}
          />
        ))
      )}
    </div>
  );
}

function SubjectHeading({ number, pull, url }: { number: number; pull: PullRequestSummary; url: string }) {
  const { central } = useCentralLayout();
  if (!central) return null;
  return (
    <header className={`px-1.5 pb-3 ${READING_WIDTH}`}>
      <h1 className="font-serif text-[48px] leading-[1.08] tracking-[0.005em] text-ink">{pull.title}</h1>
      <SubjectMeta number={number} pull={pull} url={url} />
    </header>
  );
}

function SubjectMeta({ number, pull, url }: { number: number; pull: PullRequestSummary; url: string }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[10px] leading-4 text-ink-dim">
      <span className="text-accent">#{number}</span>
      <StateTags pull={pull} />
      <span>{pull.author}</span>
      <RelativeTime iso={pull.updatedAt} />
      <OpenOnGithub url={url} />
    </div>
  );
}

interface Byline {
  author: string;
  avatarUrl?: string;
  createdAt?: string;
  url: string;
  body: string;
}

interface EntryProps extends Byline {
  owner: string;
  repo: string;
  path?: string | null;
  bodyWidth?: string;
}

function DiscussionEntry({ path, ...entry }: EntryProps) {
  if (path) return <InlineEntry {...entry} path={path} />;
  return <ConversationEntry {...entry} />;
}

function ConversationEntry({
  owner,
  repo,
  author,
  avatarUrl = '',
  createdAt,
  url,
  body,
  bodyWidth = '',
}: Omit<EntryProps, 'path'>) {
  return (
    <article className={ENTRY_CARD}>
      <header className="flex items-center gap-1.5 text-[9px] leading-4 text-ink-dim">
        <EntryAuthor author={author} avatarUrl={avatarUrl} />
        {createdAt && <RelativeTime iso={createdAt} className="shrink-0" />}
        <OpenOnGithub url={url} className="ml-auto" />
      </header>
      <MarkdownBody
        className={`markdown-body break-words text-ink ${bodyWidth}`}
        html={renderMarkdown(body, { owner, repo })}
        tooltipStyle
      />
    </article>
  );
}

function InlineEntry({ author, avatarUrl = '', createdAt, path, url, body }: Byline & { path: string }) {
  return (
    <article className={INLINE_ROW}>
      <EntryAuthor author={author} avatarUrl={avatarUrl} />
      <span className="shrink-0 font-serif text-[10px]">{path}</span>
      <span className="min-w-0 flex-1 truncate">{commentPreview(body)}</span>
      {createdAt && <RelativeTime iso={createdAt} className="shrink-0" />}
      <OpenOnGithub url={url} />
    </article>
  );
}

function EntryAuthor({ author, avatarUrl }: { author: string; avatarUrl: string }) {
  const isOwnAuthor = useIsOwnAuthor();
  if (isOwnAuthor(author)) return null;
  return (
    <>
      <AuthorPortrait avatarUrl={avatarUrl} />
      <span className="shrink-0 text-ink">{author}</span>
    </>
  );
}
