'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { repoRoute } from './repoPaths';
import { sidebarNotices, sidebarRepos, type SidebarGroup, type SidebarRepo } from './sidebarGroups';
import { removeSource } from '@/features/sources/sourceStore';
import type { CodebaseSource } from '@/features/sources/sourceTypes';
import { FilterField } from '@/features/surface-ui/FilterField';
import { HoverCardTrigger } from '@/features/surface-ui/HoverCard';
import { SelectableLink } from '@/features/surface-ui/SelectableLink';
import { StrokeIcon } from '@/features/surface-ui/StrokeIcon';

export function CodebaseList({
  groups,
  autoFocusFilter = false,
  children,
}: {
  groups: SidebarGroup[];
  autoFocusFilter?: boolean;
  children?: ReactNode;
}) {
  const [filter, setFilter] = useState('');
  const pathname = usePathname();
  const repos = useMemo(() => filterRepos(sidebarRepos(groups), filter), [groups, filter]);
  const notices = useMemo(() => sidebarNotices(groups), [groups]);
  const active = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    active.current?.scrollIntoView({ block: 'center' });
  }, [pathname]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-panel-edge px-1 py-1">
        <FilterField
          autoFocus={autoFocusFilter}
          value={filter}
          onChange={setFilter}
          placeholder="filter repositories"
          aria-label="Filter repositories"
          className="w-full"
        />
      </div>
      {children}
      <nav className="min-h-0 flex-1 overflow-auto py-1">
        {notices.map((group) => (
          <SourceNotice key={group.owner} group={group} />
        ))}
        {repos.map((repo) => (
          <RepoRow key={`${repo.owner}/${repo.name}`} repo={repo} activeRef={active} />
        ))}
      </nav>
    </div>
  );
}

function SourceNotice({ group }: { group: SidebarGroup }) {
  return (
    <div className="flex items-baseline gap-1.5 px-3 pb-1 pt-2 text-[9px] uppercase tracking-[0.18em] text-ink-dim">
      <span className="truncate">
        {group.owner}
        {group.loading && ' …'}
      </span>
      {group.source && <RemoveControl source={group.source} label={`Remove ${group.owner}`} />}
      {group.error && (
        <span className="ml-auto rounded bg-error-bg px-1 normal-case tracking-normal text-error-ink">
          {group.error}
        </span>
      )}
    </div>
  );
}

function RepoRow({ repo, activeRef }: { repo: SidebarRepo; activeRef: RefObject<HTMLAnchorElement | null> }) {
  const pathname = usePathname();
  const href = repoRoute(repo.owner, repo.name);
  const activeLink = pathname === href;
  return (
    <div className={`flex items-baseline gap-1.5 pr-2 ${activeLink ? 'bg-btn-active' : 'hover:bg-btn-hover'}`}>
      <HoverCardTrigger label={repo.description} className="min-w-0 flex-1" focusable={false} tooltipStyle>
        <SelectableLink
          ref={activeLink ? activeRef : undefined}
          href={href}
          current={activeLink}
          className={`flex min-w-0 flex-1 items-baseline justify-between gap-2 py-[3px] pl-3 text-[11px] leading-4 ${
            activeLink ? 'text-accent' : 'text-ink'
          }`}
        >
          <span className="truncate">
            <span className="text-ink-dim">{repo.owner}/</span>
            {repo.name}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[9px] text-ink-dim">
            {repo.private && <LockIcon />}
            {repo.language}
          </span>
        </SelectableLink>
      </HoverCardTrigger>
      {repo.source && <RemoveControl source={repo.source} label={`Remove ${repo.owner}/${repo.name}`} />}
    </div>
  );
}

function LockIcon() {
  return (
    <span role="img" aria-label="private" className="self-center opacity-50">
      <StrokeIcon size={9}>
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </StrokeIcon>
    </span>
  );
}

function RemoveControl({ source, label }: { source: CodebaseSource; label: string }) {
  return (
    <HoverCardTrigger label={label} className="ml-auto shrink-0" focusable={false} tooltipStyle>
      <button
        type="button"
        aria-label={label}
        onClick={() => removeSource(source)}
        className="px-1 text-[11px] leading-none text-ink-dim hover:text-error-ink"
      >
        ×
      </button>
    </HoverCardTrigger>
  );
}

function filterRepos(repos: SidebarRepo[], filter: string): SidebarRepo[] {
  const needle = filter.trim().toLowerCase();
  if (needle === '') return repos;
  return repos.filter((repo) => `${repo.owner}/${repo.name} ${repo.description}`.toLowerCase().includes(needle));
}
