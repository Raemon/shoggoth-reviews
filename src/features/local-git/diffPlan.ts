import { classifyArgs, isRange, isSymmetric, rangeEnds, type DiffArgs } from './diffArgs';
import { LocalGitError } from './gitRun';
import { INDEX_REF, WORKTREE_REF } from './localRefs';
import { headSha, mergeBase, orEmptyTree, parentSha, requireCommit } from './localRevs';
import type { LocalCommand } from './localRoutes';

export type DiffSide = { kind: 'tree'; sha: string } | { kind: 'index' } | { kind: 'worktree' };

export interface CommitRange {
  exclude: string | null;
  include: string;
}

export interface DiffPlan {
  base: DiffSide;
  head: DiffSide;
  options: string[];
  paths: string[];
  commits: CommitRange | null;
}

interface Sides {
  base: DiffSide;
  head: DiffSide;
}

const INDEX: DiffSide = { kind: 'index' };
const WORKTREE: DiffSide = { kind: 'worktree' };

export async function planChange(root: string, command: LocalCommand, args: string[]): Promise<DiffPlan> {
  const classified = await classifyArgs(root, root, args);
  return command === 'show' ? planShow(root, classified) : planDiff(root, classified);
}

export function refOf(side: DiffSide): string {
  if (side.kind === 'tree') return side.sha;
  return side.kind === 'index' ? INDEX_REF : WORKTREE_REF;
}

async function planShow(root: string, { cached, options, revs, paths }: DiffArgs): Promise<DiffPlan> {
  if (cached || revs.length > 1 || revs.some(isRange)) throw new LocalGitError(400, 'git show takes a single commit');
  const sha = await requireCommit(root, revs[0] ?? 'HEAD');
  const parent = await parentSha(root, sha);
  const base = tree(await orEmptyTree(root, parent));
  return { base, head: tree(sha), options, paths, commits: { exclude: parent, include: sha } };
}

async function planDiff(root: string, args: DiffArgs): Promise<DiffPlan> {
  const { base, head } = await diffSides(root, args);
  const commits = await commitsBetween(root, base, head);
  return { base, head, options: args.options, paths: args.paths, commits };
}

function diffSides(root: string, args: DiffArgs): Promise<Sides> {
  checkRevisions(args);
  const [first, second] = args.revs;
  if (first !== undefined && second !== undefined) return commitSides(root, first, second);
  if (first !== undefined && isRange(first)) return rangeSides(root, first);
  return args.cached ? stagedSides(root, first) : worktreeSides(root, first);
}

function checkRevisions({ cached, revs }: DiffArgs): void {
  if (revs.length > 2) throw new LocalGitError(400, 'git diff takes at most two revisions');
  const comparesCommits = revs.length === 2 || revs.some(isRange);
  if (cached && comparesCommits) throw new LocalGitError(400, '--cached compares the index with at most one commit');
}

async function commitSides(root: string, base: string, head: string): Promise<Sides> {
  return { base: tree(await requireCommit(root, base)), head: tree(await requireCommit(root, head)) };
}

async function rangeSides(root: string, range: string): Promise<Sides> {
  const [left = 'HEAD', right = 'HEAD'] = rangeEnds(range);
  const head = await requireCommit(root, right);
  const base = isSymmetric(range) ? await mergeBase(root, left, right) : await requireCommit(root, left);
  return { base: tree(base), head: tree(head) };
}

async function stagedSides(root: string, rev: string | undefined): Promise<Sides> {
  const base = rev === undefined ? await orEmptyTree(root, await headSha(root)) : await requireCommit(root, rev);
  return { base: tree(base), head: INDEX };
}

async function worktreeSides(root: string, rev: string | undefined): Promise<Sides> {
  return { base: rev === undefined ? INDEX : tree(await requireCommit(root, rev)), head: WORKTREE };
}

async function commitsBetween(root: string, base: DiffSide, head: DiffSide): Promise<CommitRange | null> {
  if (base.kind !== 'tree') return null;
  const include = head.kind === 'tree' ? head.sha : await headSha(root);
  return include === null || include === base.sha ? null : { exclude: base.sha, include };
}

function tree(sha: string): DiffSide {
  return { kind: 'tree', sha };
}
