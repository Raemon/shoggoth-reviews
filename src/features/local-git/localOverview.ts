import { headCommit } from './diffPlan';
import { gitSucceeds, gitText, nulSeparated } from './gitRun';
import { repositoryRoot } from './localRepo';
import { mapWithWorkers } from '@/features/pull-requests/workerPool';

export interface LocalOverview {
  root: string;
  branch: string | null;
  trunk: string | null;
  hasHead: boolean;
  worktree: WorktreeCounts;
  branches: LocalBranch[];
  stashes: LocalStash[];
}

export interface WorktreeCounts {
  staged: number;
  unstaged: number;
  untracked: number;
  conflicted: number;
  uncommitted: number;
}

export interface LocalBranch {
  name: string;
  date: string;
  subject: string;
  current: boolean;
  ahead: number;
  behind: number;
}

export interface LocalStash {
  sha: string;
  name: string;
  message: string;
  date: string;
}

type BranchRef = Omit<LocalBranch, 'ahead' | 'behind'>;

const UNMERGED = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']);
const FIELD = '\x1f';
const BRANCH_FORMAT = '--format=%(refname:short)%1f%(committerdate:iso-strict)%1f%(subject)%1f%(HEAD)';
const STASH_FORMAT = '--format=%H%x1f%gd%x1f%gs%x1f%cI';
const COUNT_WORKERS = 8;

export async function describeLocalRepo(repo: string): Promise<LocalOverview> {
  const root = await repositoryRoot(repo);
  const [branch, trunk, head, worktree, stashes] = await Promise.all([
    currentBranch(root),
    trunkBranch(root),
    headCommit(root),
    worktreeCounts(root),
    listStashes(root),
  ]);
  return { root, branch, trunk, hasHead: head !== null, worktree, branches: await branchesAhead(root, trunk), stashes };
}

async function currentBranch(root: string): Promise<string | null> {
  const name = await gitText(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']).catch(() => '');
  return name.trim() || null;
}

async function trunkBranch(root: string): Promise<string | null> {
  const remote = await gitText(root, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']).catch(() => '');
  for (const name of [remote.trim().replace(/^origin\//, ''), 'main', 'master'].filter(Boolean)) {
    if (await gitSucceeds(root, ['show-ref', '--verify', '--quiet', `refs/heads/${name}`])) return name;
  }
  return null;
}

async function worktreeCounts(root: string): Promise<WorktreeCounts> {
  const codes = statusCodes(await gitText(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']));
  const settled = codes.filter((code) => !UNMERGED.has(code));
  return {
    staged: settled.filter((code) => !' ?'.includes(code.charAt(0))).length,
    unstaged: settled.filter((code) => !' ?'.includes(code.charAt(1))).length,
    untracked: codes.filter((code) => code === '??').length,
    conflicted: codes.length - settled.length,
    uncommitted: codes.length,
  };
}

// A rename or copy is followed by an extra NUL field holding its original path.
function statusCodes(output: string): string[] {
  const entries = nulSeparated(output);
  const codes: string[] = [];
  for (let at = 0; at < entries.length; at += 1) {
    const code = (entries[at] ?? '').slice(0, 2);
    codes.push(code);
    if (/[RC]/.test(code)) at += 1;
  }
  return codes;
}

async function branchesAhead(root: string, trunk: string | null): Promise<LocalBranch[]> {
  if (trunk === null) return [];
  const refs = (await gitText(root, ['for-each-ref', BRANCH_FORMAT, 'refs/heads'])).split('\n').filter(Boolean).map(branchRef);
  const others = refs.filter((ref) => ref.name !== trunk);
  const counted = await mapWithWorkers(others, COUNT_WORKERS, async (ref) => ({ ...ref, ...(await aheadBehind(root, trunk, ref.name)) }));
  return counted.filter((branch) => branch.ahead > 0).sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

function branchRef(line: string): BranchRef {
  const [name = '', date = '', subject = '', head = ''] = line.split(FIELD);
  return { name, date, subject, current: head === '*' };
}

async function aheadBehind(root: string, trunk: string, name: string): Promise<{ ahead: number; behind: number }> {
  const counts = await gitText(root, ['rev-list', '--left-right', '--count', `refs/heads/${trunk}...refs/heads/${name}`]);
  const [behind = '0', ahead = '0'] = counts.trim().split(/\s+/);
  return { ahead: Number(ahead), behind: Number(behind) };
}

async function listStashes(root: string): Promise<LocalStash[]> {
  const output = await gitText(root, ['stash', 'list', STASH_FORMAT]).catch(() => '');
  return output.split('\n').filter(Boolean).map(stashOf);
}

function stashOf(line: string): LocalStash {
  const [sha = '', name = '', message = '', date = ''] = line.split(FIELD);
  return { sha, name, message, date };
}
