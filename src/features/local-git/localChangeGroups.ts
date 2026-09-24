import type { LocalBranch, LocalOverview, LocalStash, WorktreeCounts } from './localOverview';
import { localChangeRoute, type LocalCommand } from './localRoutes';
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
  empty: string;
}

export function localChangeGroups(overview: LocalOverview): LocalChangeGroup[] {
  return [
    { title: 'working tree', entries: workingEntries(overview), empty: '' },
    { title: `branches ahead of ${overview.trunk ?? 'main'}`, entries: branchEntries(overview), empty: noBranches(overview) },
    { title: 'stashes', entries: overview.stashes.map((stash) => stashEntry(overview.root, stash)), empty: 'No stashes.' },
  ];
}

function workingEntries({ root, worktree, hasHead }: LocalOverview): LocalChangeEntry[] {
  const unstaged = worktree.unstaged + worktree.untracked + worktree.conflicted;
  const entries = [
    entry(root, 'diff', [], 'unstaged changes', unstaged, unstagedNote(worktree)),
    entry(root, 'diff', ['--cached'], 'staged changes', worktree.staged, plural(worktree.staged, 'file')),
  ];
  if (!hasHead) return entries;
  return [...entries, entry(root, 'diff', ['HEAD'], 'all uncommitted changes', worktree.uncommitted, plural(worktree.uncommitted, 'file'))];
}

function unstagedNote({ unstaged, untracked, conflicted }: WorktreeCounts): string {
  const extras = [untracked > 0 ? `${untracked} new` : '', conflicted > 0 ? `${conflicted} conflicted` : ''];
  return [plural(unstaged + untracked + conflicted, 'file'), ...extras.filter(Boolean)].join(' · ');
}

function entry(root: string, command: LocalCommand, args: string[], title: string, count: number, detail: string): LocalChangeEntry {
  const token = title.slice(0, 2);
  return { route: localChangeRoute({ repo: root, command, args }), title, detail, token, quiet: count === 0, date: null };
}

function branchEntries({ root, trunk, branches }: LocalOverview): LocalChangeEntry[] {
  return trunk === null ? [] : branches.map((branch) => branchEntry(root, trunk, branch));
}

function branchEntry(root: string, trunk: string, branch: LocalBranch): LocalChangeEntry {
  const route = localChangeRoute({ repo: root, command: 'diff', args: [`${trunk}...${branch.name}`] });
  const leaf = branch.name.split('/').pop() ?? branch.name;
  const detail = `${branch.ahead} ahead${branch.behind > 0 ? ` · ${branch.behind} behind` : ''}`;
  return { route, title: branch.name, detail, token: leaf.slice(0, 2), quiet: false, date: branch.date };
}

function noBranches({ trunk }: LocalOverview): string {
  return trunk === null ? 'No main or master branch to compare with.' : 'No local branches ahead.';
}

function stashEntry(root: string, stash: LocalStash): LocalChangeEntry {
  const route = localChangeRoute({ repo: root, command: 'show', args: [stash.sha] });
  return { route, title: stash.message, detail: stash.name, token: `s${stash.name.replace(/\D/g, '')}`, quiet: false, date: stash.date };
}
