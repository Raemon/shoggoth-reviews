'use client';

import { setInlineCommentsExpanded, useInlineCommentsExpanded } from './inlineCommentsStore';
import { pullCommentsPath } from './pullPaths';
import type { PullComment } from './pullRequests';
import { smallChoiceClass } from '@/features/surface-ui/buttonStyles';
import { HoverCardTrigger } from '@/features/surface-ui/HoverCard';
import { useCachedJson } from '@/features/sources/useCachedJson';
import { useGithubToken, useStoreReady } from '@/features/sources/sourceStore';
import { usePollWhileVisible } from '@/features/sources/usePollWhileVisible';

export function InlineCommentsToggle({ owner, repo, number }: { owner: string; repo: string; number: number }) {
  const expanded = useInlineCommentsExpanded();
  const hasInline = useHasInlineComments(owner, repo, number);
  const label = expanded ? 'Collapse inline comments' : 'Expand inline comments';
  if (!hasInline) return null;
  return (
    <HoverCardTrigger label={label} focusable={false} tooltipStyle placement="top-end">
      <button
        type="button"
        aria-pressed={expanded}
        aria-label={label}
        onClick={() => setInlineCommentsExpanded(!expanded)}
        className={`${smallChoiceClass('mr-1 shrink-0')} ${expanded ? 'text-accent' : ''}`}
      >
        inline
      </button>
    </HoverCardTrigger>
  );
}

function useHasInlineComments(owner: string, repo: string, number: number): boolean {
  const ready = useStoreReady();
  const token = useGithubToken();
  const comments = useCachedJson<PullComment[]>(pullCommentsPath(owner, repo, number), token, ready);
  usePollWhileVisible(comments.reload, ready);
  return comments.data?.some((comment) => comment.path !== null) ?? false;
}
