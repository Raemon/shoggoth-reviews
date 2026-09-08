'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { closePull } from './closePull';
import { NavListRow } from './NavListRow';
import { collapsePullList, type PullListColumnName } from './collapsePullList';
import type { PullTarget } from './pullActionStore';
import { clearPullFilters, isDefaultPullFilters, usePullFilters } from './pullFilterStore';
import { prefetchPull } from './prefetchPull';
import { pullRoute, pullSubject } from './pullPaths';
import type { PullRequestSummary } from './pullRequests';
import { WorkingSparkle } from '@/features/ai-chat/WorkingSparkle';
import { useIsOwnAuthor } from '@/features/github-auth/useViewerLogin';
import { useGithubToken } from '@/features/sources/sourceStore';
import { HoverCardTrigger } from '@/features/surface-ui/HoverCard';
import { opensAnotherTab } from '@/features/surface-ui/selectableClick';
import { RelativeTime } from '@/features/surface-ui/RelativeTime';

interface PullRowSummary {
  number: number;
  title: string;
  draft: boolean;
  author: string;
  updatedAt: string;
  state: string;
  merged: boolean;
}

export const ROW_META = 'shrink-0 font-mono text-[9px] text-ink-dim';
export const LIST_NOTE = 'px-2 py-1 text-[11px] leading-4';
const NO_PULLS = 'No matching pull requests.';
export const TITLE_LINE = 'break-words px-2 pb-0.5 pt-1.5 font-serif text-[14px] leading-[1.2]';
export const META_LINE = 'flex items-center gap-1.5 px-2 pb-1.5 pt-0.5';

export function PullRowFields({ pull, target, repo, repoColumnCh }: { pull: PullRowSummary; target: PullTarget; repo?: string; repoColumnCh?: number }) {
  const isOwnAuthor = useIsOwnAuthor();
  return (
    <>
      <div className={TITLE_LINE}>{pull.title}</div>
      <div className={META_LINE}>
        {repo && (
          <span className={`${ROW_META} truncate`} style={{ width: `${repoColumnCh}ch` }}>
            {repo}
          </span>
        )}
        <span className={ROW_META}>#{pull.number}</span>
        {!isOwnAuthor(pull.author) && <span className={ROW_META}>{pull.author}</span>}
        <span className="flex-1" />
        <WorkingSparkle subject={pullSubject(target.owner, target.repo, target.number)} />
        <StateTags pull={pull} />
        <RelativeTime iso={pull.updatedAt} className={ROW_META} />
      </div>
    </>
  );
}

export function StateTags({ pull }: { pull: PullRequestSummary }) {
  return (
    <>
      {pull.draft && <RowTag>draft</RowTag>}
      {pull.state !== 'open' && <RowTag>{pull.merged ? 'merged' : 'closed'}</RowTag>}
    </>
  );
}

export function RowTag({ children }: { children: ReactNode }) {
  return <span className="shrink-0 rounded bg-btn px-1 font-mono text-[9px]">{children}</span>;
}

export function PullListRow({
  target,
  href,
  current,
  closable,
  column,
  children,
}: {
  target: PullTarget;
  href: string;
  current: boolean;
  closable: boolean;
  column: PullListColumnName;
  children: ReactNode;
}) {
  const token = useGithubToken();
  return (
    <NavListRow
      route={pullRoute(target.owner, target.repo, target.number)}
      href={href}
      current={current}
      stacked
      onPointerEnter={() => prefetchPull(target.owner, target.repo, target.number, token)}
      onSelect={(event) => {
        if (!current && !opensAnotherTab(event)) collapsePullList(column);
      }}
      trailing={closable ? <ClosePullIcon target={target} token={token} shown={current} /> : null}
    >
      {children}
    </NavListRow>
  );
}

function ClosePullIcon({ target, token, shown }: { target: PullTarget; token: string | null; shown: boolean }) {
  const router = useRouter();
  return (
    <HoverCardTrigger label={`Close #${target.number}`} className={`shrink-0 focus-within:opacity-100 group-hover:opacity-100 ${shown ? '' : 'opacity-0'}`} focusable={false} tooltipStyle>
      <button
        type="button"
        aria-label={`Close pull request #${target.number}`}
        onClick={() => closePull(target, token, (href) => router.push(href))}
        className="px-1.5 text-[11px] leading-4 text-ink-dim hover:text-ink"
      >
        ×
      </button>
    </HoverCardTrigger>
  );
}

export function NoMatchingPulls() {
  const filters = usePullFilters();
  return (
    <p className={`${LIST_NOTE} text-ink-dim`}>
      {NO_PULLS}
      {!isDefaultPullFilters(filters) && (
        <button type="button" onClick={clearPullFilters} className="ml-1 underline decoration-dotted hover:text-ink">
          clear filters
        </button>
      )}
    </p>
  );
}
