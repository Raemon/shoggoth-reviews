'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { repoBeingRead, repoRoute } from './repoPaths';
import { sidebarNotices, sidebarRepos, type SidebarGroup, type SidebarRepo } from './sidebarGroups';
import type { RepoRef } from '@/features/sources/parseRepoLink';
import { removeSource } from '@/features/sources/sourceStore';
import type { CodebaseSource } from '@/features/sources/sourceTypes';
import { FilterField } from '@/features/surface-ui/FilterField';
import { HoverCardTrigger } from '@/features/surface-ui/HoverCard';
import { SelectableLink } from '@/features/surface-ui/SelectableLink';
import { StrokeIcon } from '@/features/surface-ui/StrokeIcon';

export function CodebaseList({
  groups,
  autoFocusFilter = false,
  onOpenRepo,
  children,
}: {
  groups: SidebarGroup[];
  autoFocusFilter?: boolean;
  onOpenRepo?: () => void;
  children?: ReactNode;
}) {
  const [filter, setFilter] = useState('');
  const pathname = usePathname();
  const all = useMemo(() => sidebarRepos(groups), [groups]);
  const reading = useMemo(() => currentRepo(all, repoBeingRead(pathname), filter), [all, pathname, filter]);
  const repos = useMemo(() => filterRepos(all, filter).filter((repo) => !sameRepo(repo, reading)), [all, filter, reading]);
  const notices = useMemo(() => sidebarNotices(groups), [groups]);
  const openTopRepo = useOpenTopRepo(reading ?? repos[0] ?? null, onOpenRepo);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-panel-edge px-1 py-1">
        <FilterField
          autoFocus={autoFocusFilter}
          value={filter}
          onChange={setFilter}
          onKeyDown={openTopRepo}
          placeholder="filter repositories"
          aria-label="Filter repositories"
        />
      </div>
      {reading && (
        <div className="border-b border-panel-edge">
          <RepoRow repo={reading} active />
        </div>
      )}
      {children}
      <nav className="min-h-0 flex-1 overflow-auto py-1">
        {notices.map((group) => (
          <SourceNotice key={group.owner} group={group} />
        ))}
        {repos.map((repo) => (
          <RepoRow key={`${repo.owner}/${repo.name}`} repo={repo} />
        ))}
      </nav>
    </div>
  );
}

function useOpenTopRepo(top: SidebarRepo | null, onOpenRepo?: () => void) {
  const router = useRouter();
  return (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || top === null) return;
    event.preventDefault(); // else the re-focused menu button takes Enter's default click and reopens
    router.push(repoRoute(top.owner, top.name));
    onOpenRepo?.();
  };
}

function currentRepo(repos: SidebarRepo[], reading: RepoRef | null, filter: string): SidebarRepo | null {
  if (reading === null) return null;
  const shown = repos.find((repo) => sameRepo(repo, reading)) ?? unlistedRepo(reading);
  return matchesFilter(shown, filter) ? shown : null;
}

function sameRepo(repo: RepoRef, other: RepoRef | null): boolean {
  return other !== null && repo.owner.toLowerCase() === other.owner.toLowerCase() && repo.name.toLowerCase() === other.name.toLowerCase();
}

function unlistedRepo({ owner, name }: RepoRef): SidebarRepo {
  return { owner, name, description: '', language: '', updatedAt: '', private: false, defaultBranch: '', source: null };
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

function RepoRow({ repo, active = false }: { repo: SidebarRepo; active?: boolean }) {
  const pathname = usePathname();
  const href = repoRoute(repo.owner, repo.name);
  const onThisPage = pathname === href;
  const highlighted = active || onThisPage;
  return (
    <div className={`flex items-baseline gap-1.5 pr-2 ${highlighted ? 'bg-btn-active' : 'hover:bg-btn-hover'}`}>
      <HoverCardTrigger label={repo.description} className="min-w-0 flex-1" focusable={false} tooltipStyle>
        <SelectableLink
          href={href}
          current={onThisPage}
          className={`flex min-w-0 flex-1 items-baseline justify-between gap-2 py-[3px] pl-3 text-[11px] leading-4 ${
            highlighted ? 'text-accent' : 'text-ink'
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
  return repos.filter((repo) => matchesFilter(repo, filter));
}

function matchesFilter(repo: SidebarRepo, filter: string): boolean {
  const needle = filter.trim().toLowerCase();
  return needle === '' || `${repo.owner}/${repo.name} ${repo.description}`.toLowerCase().includes(needle);
}
