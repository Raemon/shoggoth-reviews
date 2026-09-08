'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { CodebaseList } from './CodebaseList';
import { HeaderMenu } from './HeaderMenu';
import type { CommandSpec } from '@/features/hotkeys/commandStore';
import { branchBeingRead, pullBeingRead, repoBeingRead, repoRoute } from './repoPaths';
import { sidebarGroups } from './sidebarGroups';
import { useSourceResults } from './useSourceResults';
import { ScopeMark } from '@/features/brand/ScopeMark';
import { CurrentBranchTitle, CurrentPullTitle } from '@/features/pull-requests/CurrentPullTitle';
import { MergePullButton } from '@/features/pull-requests/MergePullButton';
import { PreviewLink } from '@/features/pull-requests/PreviewLink';
import { PullBranchRefs } from '@/features/pull-requests/PullBranchRefs';
import { ALL_PULLS_ROWS, setPullAuthor, useOfferedPullAuthors, useShownPullAuthor, type PullAuthor } from '@/features/pull-requests/pullFilterStore';
import { PullFilterMenu } from '@/features/pull-requests/PullFilterMenu';
import { PullRequestMenu } from '@/features/pull-requests/PullRequestMenu';
import { ViewModeToggle } from '@/features/pull-requests/ViewModeToggle';
import { useViewMode } from '@/features/pull-requests/viewModeStore';
import { type RepoRef } from '@/features/sources/parseRepoLink';
import { opensAnotherTab } from '@/features/surface-ui/selectableClick';
import { SelectableLink } from '@/features/surface-ui/SelectableLink';
import { ThemeToggle } from '@/features/theme/ThemeToggle';
import { disconnectGithub, useGithubAccess, useGithubToken, useSources, useStoreReady } from '@/features/sources/sourceStore';
import { GithubSignedOutNotice } from '@/features/sources/GithubSignedOutNotice';

const ALL_PULLS = '/pulls';

const REPO_MENU_COMMAND: CommandSpec = { id: 'repo-menu', label: 'repositories menu', keys: ['0', 'r'] };

export function CodebaseHeader() {
  const pathname = usePathname();
  const central = useViewMode() === 'central';
  const reading = repoBeingRead(pathname);
  const pullNumber = pullBeingRead(pathname);
  const branch = branchBeingRead(pathname);
  const readingPullList = reading !== null && pathname === repoRoute(reading.owner, reading.name);
  const readingChange = reading !== null && (pullNumber !== null || branch !== null);
  return (
    <header className={`relative z-40 flex items-center gap-2 bg-panel px-2 py-5 ${central ? '' : 'border-b border-panel-edge'}`}>
      <Link href="/" aria-label="reposcope home" className="shrink-0">
        <ScopeMark size={20} title="reposcope home" />
      </Link>
      <CodebaseMenu reading={reading} />
      {central && readingChange && <PullFilterMenu />}
      {reading && !readingPullList && <HeaderSubject repo={reading} pullNumber={pullNumber} branch={branch} />}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <GithubSignedOutNotice />
        {reading && pullNumber !== null && (
          <>
            <PreviewLink key={`${reading.owner}/${reading.name}#${pullNumber}`} repo={reading} number={pullNumber} />
            <MergePullButton repo={reading} number={pullNumber} />
            <PullBranchRefs repo={reading} number={pullNumber} />
          </>
        )}
        {readingChange && <ViewModeToggle />}
        <ThemeToggle />
      </div>
    </header>
  );
}

// Central mode: the discussion column shows the title, so don't repeat it here.
function HeaderSubject({ repo, pullNumber, branch }: { repo: RepoRef; pullNumber: number | null; branch: string | null }) {
  const central = useViewMode() === 'central';
  if (pullNumber !== null) return central ? null : <CurrentPullTitle repo={repo} number={pullNumber} />;
  if (branch !== null) return <CurrentBranchTitle repo={repo} branch={branch} />;
  return <PullRequestMenu repo={repo} />;
}

function CodebaseMenu({ reading }: { reading: RepoRef | null }) {
  const pathname = usePathname();
  const readingAllPulls = pathname === ALL_PULLS;
  const ready = useStoreReady();
  const sources = useSources();
  const token = useGithubToken();
  const access = useGithubAccess();
  const results = useSourceResults(sources, token, ready, access);
  const connected = sources.some((source) => source.kind === 'viewer');
  const author = useShownPullAuthor();

  return (
    <HeaderMenu
      label={readingAllPulls ? ALL_PULLS_ROWS[author].label : reading ? <RepoLabel reading={reading} /> : 'Codebases'}
      width="w-80"
      command={REPO_MENU_COMMAND}
    >
      {(close) => (
        <>
          {ready && sources.length > 0 ? (
            <CodebaseList groups={sidebarGroups(sources, results)} autoFocusFilter>
              <AllPullsRows active={readingAllPulls} close={close} />
            </CodebaseList>
          ) : (
            <>
              <AllPullsRows active={readingAllPulls} close={close} />
              <MenuNotice ready={ready} reading={reading} />
            </>
          )}
          {connected && (
            <div className="border-t border-panel-edge px-2 py-1">
              <button
                type="button"
                onClick={disconnectGithub}
                className="text-[10px] text-ink-dim hover:text-error-ink"
              >
                disconnect GitHub
              </button>
              {access === 'public' && <span className="ml-2 text-[10px] text-ink-dim">public repositories only</span>}
            </div>
          )}
        </>
      )}
    </HeaderMenu>
  );
}

function MenuNotice({ ready, reading }: { ready: boolean; reading: RepoRef | null }) {
  if (!ready) return <p className="px-2 py-1 text-[11px] leading-4 text-ink-dim">Loading…</p>;
  if (reading) return <ReadingRow reading={reading} />;
  return (
    <p className="px-2 py-1 text-[11px] leading-4 text-ink-dim">
      No repositories yet.{' '}
      <Link href="/" className="text-accent underline">
        Add one
      </Link>{' '}
      to get started.
    </p>
  );
}

function AllPullsRows({ active, close }: { active: boolean; close: () => void }) {
  const author = useShownPullAuthor();
  return useOfferedPullAuthors().map((choice) => (
    <AllPullsRow key={choice} choice={choice} active={active && author === choice} close={close} />
  ));
}

function AllPullsRow({ choice, active, close }: { choice: PullAuthor; active: boolean; close: () => void }) {
  const select = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    setPullAuthor(choice);
    if (!opensAnotherTab(event)) close();
  };
  return (
    <MenuRow href={ALL_PULLS} active={active} label={ALL_PULLS_ROWS[choice].label} onSelect={select}>
      {ALL_PULLS_ROWS[choice].note}
    </MenuRow>
  );
}

function RepoLabel({ reading }: { reading: RepoRef }) {
  return (
    <>
      <span className="hidden text-ink-dim/70 md:inline">{reading.owner}/</span>
      {reading.name}
    </>
  );
}

function MenuRow({
  href,
  active,
  label,
  onSelect,
  children,
}: {
  href: string;
  active: boolean;
  label: string;
  onSelect: (event: ReactMouseEvent<HTMLAnchorElement>) => void;
  children: ReactNode;
}) {
  return (
    <SelectableLink
      href={href}
      current={active}
      onSelect={onSelect}
      className={`flex items-baseline gap-1.5 border-b border-panel-edge px-2 py-1 text-[11px] leading-4 ${
        active ? 'bg-btn-active text-accent' : 'text-ink hover:bg-btn-hover'
      }`}
    >
      <span className="shrink-0">{label}</span>
      <span className="min-w-0 flex-1 truncate text-[9px] text-ink-dim">{children}</span>
    </SelectableLink>
  );
}

function ReadingRow({ reading }: { reading: RepoRef }) {
  return (
    <nav className="min-h-0 flex-1 overflow-auto py-[1px]">
      <h2 className="px-2 pt-1 text-[9px] uppercase tracking-[0.18em] text-ink-dim">{reading.owner}</h2>
      <div className="flex items-baseline gap-1.5 bg-btn-active pr-2">
        <SelectableLink
          href={repoRoute(reading.owner, reading.name)}
          current
          className="flex min-w-0 flex-1 items-baseline justify-between gap-2 py-[1px] pl-2 text-[11px] leading-4 text-accent"
        >
          <span className="truncate">{reading.name}</span>
          <span className="shrink-0 text-[9px] text-ink-dim">reading</span>
        </SelectableLink>
      </div>
    </nav>
  );
}
