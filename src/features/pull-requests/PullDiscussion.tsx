'use client';

import { pullCommentsPath, pullUrl } from './pullPaths';
import { AuthorPortrait, OpenOnGithub } from './CommentByline';
import { renderMarkdown } from '@/features/markdown/renderMarkdown';
import type { PullComment } from './pullRequests';
import { useGithubToken, useStoreReady } from '@/features/sources/sourceStore';
import { MarkdownBody } from '@/features/markdown/MarkdownBody';
import { RelativeTime } from '@/features/surface-ui/RelativeTime';
import { useCachedJson } from '@/features/sources/useCachedJson';
import { useIsOwnAuthor } from '@/features/github-auth/useViewerLogin';
import { usePollWhileVisible } from '@/features/sources/usePollWhileVisible';

const READING_WIDTH = 'max-w-[720px]';

export function PullDiscussion({
  owner,
  repo,
  number,
  author,
  body,
}: {
  owner: string;
  repo: string;
  number: number;
  author: string;
  body: string | null;
}) {
  const ready = useStoreReady();
  const token = useGithubToken();
  const commentState = useCachedJson<PullComment[]>(pullCommentsPath(owner, repo, number), token, ready);
  const { data: comments, error } = commentState;

  usePollWhileVisible(commentState.reload, ready);

  return (
    <div className="flex flex-col">
      <DiscussionEntry
        owner={owner}
        repo={repo}
        author={author}
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

function DiscussionEntry({
  owner,
  repo,
  author,
  avatarUrl = '',
  createdAt,
  path,
  url,
  body,
  bodyWidth = '',
}: {
  owner: string;
  repo: string;
  author: string;
  avatarUrl?: string;
  createdAt?: string;
  path?: string | null;
  url: string;
  body: string;
  bodyWidth?: string;
}) {
  const isOwnAuthor = useIsOwnAuthor();
  return (
    <article className="border-b border-panel-edge px-1.5 py-1">
      <header className="flex items-center gap-1.5 text-[9px] leading-4 text-ink-dim">
        {!isOwnAuthor(author) && (
          <>
            <AuthorPortrait avatarUrl={avatarUrl} />
            <span className="shrink-0 text-ink">{author}</span>
          </>
        )}
        {createdAt && <RelativeTime iso={createdAt} className="shrink-0" />}
        {path && <span className="min-w-0 flex-1 truncate font-serif text-[10px]">{path}</span>}
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
