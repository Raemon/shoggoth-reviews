'use client';

import type { ReactNode } from 'react';
import { ChangeCountCells } from './ChangeCounts';
import type { PreviewToken } from './ColumnPreview';
import { useColumnNav, type ColumnRow } from './columnNav';
import type { ChangeSummary, CommitSummary } from './pullRequests';
import { CopyButton } from '@/features/surface-ui/CopyButton';
import { OpenOnGithubLink } from '@/features/surface-ui/OpenOnGithubLink';
import { RelativeTime } from '@/features/surface-ui/RelativeTime';
import { rowStateClass } from '@/features/surface-ui/rowState';
import { SelectableRow } from '@/features/surface-ui/SelectableRow';

const TITLE_LINE = 'w-full break-words px-1.5 pb-0.5 pt-1 text-left font-serif text-[14px] leading-[1.2]';
const META_LINE = 'flex flex-1 items-center gap-1.5 px-1.5 py-0.5 text-left font-mono text-[9px] leading-4 text-ink-dim';
const HASH_CELL = 'ml-1.5 flex w-[6ch] shrink-0 items-center gap-0.5 font-mono text-[9px] leading-4';
const HASH_BUTTON = 'w-[3ch] text-left hover:text-accent';
const COMMIT_LINK = 'text-ink-dim/50 opacity-0 transition-opacity hover:text-accent focus-visible:opacity-100 group-hover:opacity-100';
const HASH_CHARS = 3;
export const WHOLE_CHANGE = 'all';
const WHOLE_CHANGES_ROW = { title: 'all changes', counts: true };

export function PullCommitColumn({
  owner,
  repo,
  change,
  selection,
  onSelect,
  whole = WHOLE_CHANGES_ROW,
}: {
  owner: string;
  repo: string;
  change: ChangeSummary;
  selection: string;
  onSelect: (selection: string) => void;
  whole?: { title: string; counts: boolean };
}) {
  const nav = useColumnNav('commits');
  const rowFor = (item: string) => nav.row(item, item === selection);
  return (
    <>
      <CommitRow row={rowFor(WHOLE_CHANGE)} onActivate={() => onSelect(WHOLE_CHANGE)} title={whole.title} hash={<span aria-hidden className={HASH_CELL} />}>
        <span className="flex-1" />
        {whole.counts && <ChangeCountCells additions={change.additions} deletions={change.deletions} />}
      </CommitRow>
      {change.commits.map((commit) => (
        <CommitEntry
          key={commit.sha}
          commit={commit}
          owner={owner}
          repo={repo}
          row={rowFor(commit.sha)}
          onActivate={() => onSelect(commit.sha)}
        />
      ))}
    </>
  );
}

function CommitEntry({
  commit,
  owner,
  repo,
  row,
  onActivate,
}: {
  commit: CommitSummary;
  owner: string;
  repo: string;
  row: ColumnRow;
  onActivate: () => void;
}) {
  return (
    <CommitRow row={row} onActivate={onActivate} title={commit.message} hash={<CommitHash owner={owner} repo={repo} sha={commit.sha} />}>
      <span className="truncate">{commit.author}</span>
      <span className="flex-1" />
      <span>{commit.fileCount}f</span>
      <ChangeCountCells additions={commit.additions} deletions={commit.deletions} />
      <RelativeTime iso={commit.date} />
    </CommitRow>
  );
}

function CommitRow({
  row,
  onActivate,
  title,
  hash,
  children,
}: {
  row: ColumnRow;
  onActivate: () => void;
  title: string;
  hash: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      data-nav-cursor={row.props.cursor || undefined}
      onPointerEnter={row.props.onPointerEnter}
      className={`group border-b border-panel-edge ${rowStateClass(row.state)}`}
    >
      <SelectableRow {...row.props} onActivate={onActivate} className={TITLE_LINE} label={title}>
        {title}
      </SelectableRow>
      <div className="flex items-center">
        {hash}
        <SelectableRow onPointerEnter={row.props.onPointerEnter} onActivate={onActivate} className={META_LINE}>
          {children}
        </SelectableRow>
      </div>
    </div>
  );
}

function CommitHash({ owner, repo, sha }: { owner: string; repo: string; sha: string }) {
  return (
    <span className={HASH_CELL}>
      <CopyHash sha={sha} />
      <OpenOnGithubLink href={`https://github.com/${owner}/${repo}/commit/${sha}`} label={`commit ${sha.slice(0, 7)}`} className={COMMIT_LINK} />
    </span>
  );
}

function CopyHash({ sha }: { sha: string }) {
  return (
    <CopyButton value={sha} what={sha} ariaLabel={`Copy commit hash ${sha}`} className={HASH_BUTTON} idleClassName="text-ink-dim/50">
      {sha.slice(0, HASH_CHARS)}
    </CopyButton>
  );
}

export function commitItems(change: ChangeSummary): string[] {
  return [WHOLE_CHANGE, ...change.commits.map((commit) => commit.sha)];
}

export function commitTokens(change: ChangeSummary, selection: string): PreviewToken[] {
  return [
    { key: WHOLE_CHANGE, label: '∀', title: 'all changes', accent: selection === WHOLE_CHANGE },
    ...change.commits.map((commit) => ({
      key: commit.sha,
      label: commit.sha.slice(0, 2),
      title: `${commit.sha.slice(0, 7)} · ${commit.message}`,
      accent: commit.sha === selection,
    })),
  ];
}
