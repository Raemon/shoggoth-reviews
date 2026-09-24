import { planChange, refOf, type DiffPlan, type DiffSide } from './diffPlan';
import { parseGitPatch } from './gitPatch';
import { gitText } from './gitRun';
import { listCommits } from './localCommits';
import { repositoryRoot } from './localRepo';
import type { LocalCommand } from './localRoutes';
import { untrackedChanges } from './untrackedFiles';
import type { ChangedFile, ChangedFileSet, ChangeSummary } from '@/features/pull-requests/pullRequests';

export interface LocalChangeSet extends ChangedFileSet, ChangeSummary {}

// Pinned so user config (noprefix, mnemonicPrefix, external diff, textconv) can't reshape the patch.
const DIFF_FLAGS = [
  '--no-color',
  '--no-ext-diff',
  '--no-textconv',
  '--no-relative',
  '--find-renames',
  '--src-prefix=a/',
  '--dst-prefix=b/',
];

export async function describeLocalChange(repo: string, command: LocalCommand, args: string[]): Promise<LocalChangeSet> {
  const root = await repositoryRoot(repo);
  const plan = await planChange(root, command, args);
  const [files, commits] = await Promise.all([diffFiles(root, plan), listCommits(root, plan.commits)]);
  return { ...fileSetOf(plan, files), commits, additions: total(files, 'additions'), deletions: total(files, 'deletions') };
}

export async function listLocalCommitFiles(repo: string, sha: string): Promise<ChangedFileSet> {
  const root = await repositoryRoot(repo);
  const plan = await planChange(root, 'show', [sha]);
  return fileSetOf(plan, await diffFiles(root, plan));
}

function fileSetOf(plan: DiffPlan, files: ChangedFile[]): ChangedFileSet {
  return { baseRef: refOf(plan.base), headRef: refOf(plan.head), files };
}

async function diffFiles(root: string, plan: DiffPlan): Promise<ChangedFile[]> {
  const parsed = parseGitPatch(await gitText(root, diffCommand(plan)));
  const [conflicted, untracked] = await Promise.all([
    conflictedFiles(root, parsed.unmerged),
    plan.head.kind === 'worktree' ? untrackedChanges(root, plan.paths) : [],
  ]);
  return [...parsed.files, ...conflicted, ...untracked].sort((a, b) => a.filename.localeCompare(b.filename));
}

function diffCommand({ base, head, options, paths }: DiffPlan): string[] {
  return ['diff', ...DIFF_FLAGS, ...options, ...sideArgs(base, head), '--', ...paths];
}

function sideArgs(base: DiffSide, head: DiffSide): string[] {
  if (base.kind !== 'tree') return [];
  if (head.kind === 'index') return ['--cached', base.sha];
  return head.kind === 'tree' ? [base.sha, head.sha] : [base.sha];
}

// Git shows unmerged files as combined diffs; against our side, the conflict markers read as additions.
async function conflictedFiles(root: string, paths: string[]): Promise<ChangedFile[]> {
  if (paths.length === 0) return [];
  const { files } = parseGitPatch(await gitText(root, ['diff', ...DIFF_FLAGS, '--ours', '--', ...paths]));
  return files.map((file) => ({ ...file, status: 'conflicted' }));
}

function total(files: ChangedFile[], field: 'additions' | 'deletions'): number {
  return files.reduce((sum, file) => sum + file[field], 0);
}
