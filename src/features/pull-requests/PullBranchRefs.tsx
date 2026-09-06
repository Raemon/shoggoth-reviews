'use client';

import { useState } from 'react';
import type { BranchOption } from './branches';
import { reloadCurrentPull, useCurrentPull } from './currentPullStore';
import { branchOptionsPath, retargetPullPath } from './pullPaths';
import { apiPost } from '@/features/sources/apiClient';
import type { RepoRef } from '@/features/sources/parseRepoLink';
import { useGithubToken, useStoreReady } from '@/features/sources/sourceStore';
import { errorMessage } from '@/features/sources/errorMessage';
import { useCachedJson, type CachedJson } from '@/features/sources/useCachedJson';
import { FilterField } from '@/features/surface-ui/FilterField';
import { FailureNote } from '@/features/surface-ui/FailureNote';
import { HoverCardTrigger } from '@/features/surface-ui/HoverCard';
import { PaneStatusLine } from '@/features/surface-ui/PaneStatusLine';
import { PopoverMenu, type PopoverTrigger } from '@/features/surface-ui/PopoverMenu';
import { RelativeTime } from '@/features/surface-ui/RelativeTime';

const REF_TEXT = 'max-w-40 truncate font-mono text-[10px]';

export function PullBranchRefs({ repo, number }: { repo: RepoRef; number: number }) {
  const pull = useCurrentPull(repo.owner, repo.name, number);
  if (pull === null) return null;
  return (
    <div className="hidden shrink-0 items-center gap-1.5 text-[10px] text-ink-dim md:flex">
      <HoverCardTrigger label={headRefLabel(pull.headRef)} focusable={false} tooltipStyle>
        <span className={REF_TEXT}>{pull.headRef}</span>
      </HoverCardTrigger>
      <span aria-hidden className="text-ink-dim/40">
        →
      </span>
      <BaseRefPicker repo={repo} number={number} baseRef={pull.baseRef} headRef={pull.headRef} />
    </div>
  );
}

function headRefLabel(headRef: string): string {
  return `${headRef} — GitHub cannot move a pull request to a different head branch; open a new one instead`;
}

function BaseRefPicker({
  repo,
  number,
  baseRef,
  headRef,
}: {
  repo: RepoRef;
  number: number;
  baseRef: string;
  headRef: string;
}) {
  const token = useGithubToken();
  const [retargeting, setRetargeting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function retarget(base: string) {
    setFailure(null);
    setRetargeting(true);
    try {
      await apiPost(retargetPullPath(repo.owner, repo.name, number, base), token);
    } catch (issue: unknown) {
      return setFailure(`retarget refused: ${errorMessage(issue)}`);
    } finally {
      setRetargeting(false);
    }
    await reloadCurrentPull().catch((issue: unknown) => setFailure(`base changed; reload failed: ${errorMessage(issue)}`));
  }

  return (
    <>
      {failure !== null && <FailureNote label={failure} />}
      <PopoverMenu
        align="right-0"
        panelClass="flex max-h-[70vh] w-72 flex-col overflow-hidden"
        trigger={(state) => <BaseRefButton baseRef={baseRef} retargeting={retargeting} {...state} />}
      >
        {(close) => (
          <BranchChoices
            repo={repo}
            skip={[headRef, baseRef]}
            onChoose={(base) => {
              close();
              void retarget(base);
            }}
          />
        )}
      </PopoverMenu>
    </>
  );
}

function BaseRefButton({ baseRef, retargeting, open, toggle }: PopoverTrigger & { baseRef: string; retargeting: boolean }) {
  return (
    <button
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={`Base branch ${baseRef} — choose another`}
      onClick={toggle}
      disabled={retargeting}
      className={`flex items-center gap-1 rounded px-1 py-0.5 disabled:opacity-40 ${
        open ? 'bg-btn-active text-accent' : 'text-ink-dim hover:bg-btn-hover hover:text-ink'
      }`}
    >
      <span className={REF_TEXT}>{retargeting ? 'retargeting…' : baseRef}</span>
      <span aria-hidden className="text-[9px] text-ink-dim/60">
        ▾
      </span>
    </button>
  );
}

function BranchChoices({
  repo,
  skip,
  onChoose,
}: {
  repo: RepoRef;
  skip: string[];
  onChoose: (base: string) => void;
}) {
  const [filter, setFilter] = useState('');
  const branches = useBranchOptions(repo);
  const shown = matchingBranches(branches.data ?? [], skip, filter);
  return (
    <>
      <div className="border-b border-panel-edge px-2 py-2">
        <FilterField
          autoFocus
          value={filter}
          onChange={setFilter}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && shown[0]) onChoose(shown[0].name);
          }}
          placeholder="filter branches"
          aria-label="Filter branches"
        />
      </div>
      <nav className="min-h-0 flex-1 overflow-auto py-1">
        <BranchList branches={branches} shown={shown} onChoose={onChoose} />
      </nav>
    </>
  );
}

function BranchList({
  branches,
  shown,
  onChoose,
}: {
  branches: CachedJson<BranchOption[]>;
  shown: BranchOption[];
  onChoose: (base: string) => void;
}) {
  const { data, error, reload } = branches;
  if (error !== null) return <PaneStatusLine tone="error" onRetry={reload}>{error}</PaneStatusLine>;
  if (data === null) return <PaneStatusLine tone="dim">Loading branches…</PaneStatusLine>;
  if (shown.length === 0) return <PaneStatusLine tone="dim">No matching branches.</PaneStatusLine>;
  return <>{shown.map((branch) => <BranchChoice key={branch.name} branch={branch} onChoose={onChoose} />)}</>;
}

function BranchChoice({ branch, onChoose }: { branch: BranchOption; onChoose: (base: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChoose(branch.name)}
      className="flex w-full items-baseline gap-2 px-2 py-1 text-left text-[11px] leading-4 text-ink hover:bg-btn-hover"
    >
      <span className="min-w-0 flex-1 truncate font-mono">{branch.name}</span>
      <RelativeTime iso={branch.updatedAt} className="shrink-0 text-[9px] text-ink-dim" />
    </button>
  );
}

function useBranchOptions(repo: RepoRef) {
  const ready = useStoreReady();
  const token = useGithubToken();
  return useCachedJson<BranchOption[]>(branchOptionsPath(repo.owner, repo.name), token, ready);
}

function matchingBranches(branches: BranchOption[], skip: string[], filter: string): BranchOption[] {
  const wanted = filter.trim().toLowerCase();
  return branches.filter((branch) => !skip.includes(branch.name) && branch.name.toLowerCase().includes(wanted));
}
