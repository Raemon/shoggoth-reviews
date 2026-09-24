import type { LocalBranch, LocalOverview, LocalStash, WorktreeCounts } from './localOverview';
import { localChangeRoute } from './localRoutes';
import { branchToken } from '@/features/pull-requests/ColumnPreview';
import { plural } from '@/features/surface-ui/plural';

export interface LocalChangeEntry {
  route: string;
  title: string;
  detail: string;
  token: string;
  quiet: boolean;
  date: string | null;
}

export interface LocalChangeGroup {
  title: string;
  entries: LocalChangeEntry[];
  empty?: string;
}

export function localChangeGroups(overview: LocalOverview): LocalChangeGroup[] {
  return [
    { title: 'working tree', entries: workingEntries(overview) },
    { title: `branches ahead of ${overview.trunk ?? 'main'}`, entries: branchEntries(overview), empty: noBranches(overview) },
    { title: 'stashes', entries: overview.stashes.map((stash) => stashEntry(overview.root, stash)), empty: 'No stashes.' },
  ];
}

function workingEntries({ root, worktree, hasHead }: LocalOverview): LocalChangeEntry[] {
  const unstaged = workingEntry(root, [], 'unstaged changes', unstagedCount(worktree), unstagedNote(worktree));
  const staged = workingEntry(root, ['--cached'], 'staged changes', worktree.staged);
  const all = workingEntry(root, ['HEAD'], 'all uncommitted changes', worktree.uncommitted);
  return hasHead ? [unstaged, staged, all] : [unstaged, staged];
}

function workingEntry(root: string, args: string[], title: string, count: number, detail = plural(count, 'file')): LocalChangeEntry {
  const route = localChangeRoute({ repo: root, command: 'diff', args });
  return { route, title, detail, token: title.slice(0, 2), quiet: count === 0, date: null };
}

function unstagedCount({ unstaged, untracked, conflicted }: WorktreeCounts): number {
  return unstaged + untracked + conflicted;
}

function unstagedNote(worktree: WorktreeCounts): string {
  const notes = [plural(unstagedCount(worktree), 'file'), countNote(worktree.untracked, 'new'), countNote(worktree.conflicted, 'conflicted')];
  return notes.filter(Boolean).join(' · ');
}

function countNote(count: number, word: string): string {
  return count > 0 ? `${count} ${word}` : '';
}

function branchEntries({ root, trunk, branches }: LocalOverview): LocalChangeEntry[] {
  return trunk === null ? [] : branches.map((branch) => branchEntry(root, trunk, branch));
}

function branchEntry(root: string, trunk: string, branch: LocalBranch): LocalChangeEntry {
  const route = localChangeRoute({ repo: root, command: 'diff', args: [`${trunk}...${branch.name}`] });
  return { route, title: branch.name, detail: aheadBehind(branch), token: branchToken(branch.name), quiet: false, date: branch.date };
}

function aheadBehind({ ahead, behind }: LocalBranch): string {
  return behind > 0 ? `${ahead} ahead · ${behind} behind` : `${ahead} ahead`;
}

function noBranches({ trunk }: LocalOverview): string {
  return trunk === null ? 'No main or master branch to compare with.' : 'No local branches ahead.';
}

function stashEntry(root: string, stash: LocalStash): LocalChangeEntry {
  const route = localChangeRoute({ repo: root, command: 'show', args: [stash.sha] });
  return { route, title: stash.message, detail: stash.name, token: stashToken(stash.name), quiet: false, date: stash.date };
}

function stashToken(name: string): string {
  return `s${name.replace(/\D/g, '')}`;
}
