import { FIELD, gitLine, gitSucceeds, gitText, lineSeparated, nulSeparated } from './gitRun';
import { repositoryRoot } from './localRepo';
import { headSha } from './localRevs';
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
const UNCHANGED = ' ?';
const BRANCH_FORMAT = '--format=%(refname:lstrip=2)%1f%(committerdate:iso-strict)%1f%(subject)%1f%(HEAD)';
const STASH_FORMAT = '--format=%H%x1f%gd%x1f%gs%x1f%cI';
const COUNT_WORKERS = 8;

export async function describeLocalRepo(repo: string): Promise<LocalOverview> {
  const root = await repositoryRoot(repo);
  const [branch, trunk, head, worktree, stashes] = await Promise.all([
    gitLine(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']),
    trunkBranch(root),
    headSha(root),
    worktreeCounts(root),
    listStashes(root),
  ]);
  const branches = await branchesAhead(root, trunk);
  return { root, branch, trunk, hasHead: head !== null, worktree, branches, stashes };
}

async function trunkBranch(root: string): Promise<string | null> {
  const remoteDefault = await gitLine(root, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']);
  for (const name of [remoteDefault?.replace(/^origin\//, ''), 'main', 'master']) {
    if (name && (await gitSucceeds(root, ['show-ref', '--verify', '--quiet', `refs/heads/${name}`]))) return name;
  }
  return null;
}

async function worktreeCounts(root: string): Promise<WorktreeCounts> {
  const codes = statusCodes(await gitText(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']));
  const settled = codes.filter((code) => !UNMERGED.has(code));
  return {
    staged: settled.filter((code) => !UNCHANGED.includes(code.charAt(0))).length,
    unstaged: settled.filter((code) => !UNCHANGED.includes(code.charAt(1))).length,
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
  const others = (await branchRefs(root)).filter((ref) => ref.name !== trunk);
  const counted = await mapWithWorkers(others, COUNT_WORKERS, async (ref) => ({ ...ref, ...(await aheadBehind(root, trunk, ref.name)) }));
  return counted.filter((branch) => branch.ahead > 0).sort(newestFirst);
}

async function branchRefs(root: string): Promise<BranchRef[]> {
  return lineSeparated(await gitText(root, ['for-each-ref', BRANCH_FORMAT, 'refs/heads'])).map((line) => {
    const [name = '', date = '', subject = '', head = ''] = line.split(FIELD);
    return { name, date, subject, current: head === '*' };
  });
}

async function aheadBehind(root: string, trunk: string, name: string): Promise<{ ahead: number; behind: number }> {
  const counts = await gitText(root, ['rev-list', '--left-right', '--count', `refs/heads/${trunk}...refs/heads/${name}`]);
  const [behind = '0', ahead = '0'] = counts.trim().split(/\s+/);
  return { ahead: Number(ahead), behind: Number(behind) };
}

function newestFirst(a: LocalBranch, b: LocalBranch): number {
  return Date.parse(b.date) - Date.parse(a.date);
}

async function listStashes(root: string): Promise<LocalStash[]> {
  return lineSeparated(await gitText(root, ['stash', 'list', STASH_FORMAT]).catch(() => '')).map((line) => {
    const [sha = '', name = '', message = '', date = ''] = line.split(FIELD);
    return { sha, name, message, date };
  });
}
