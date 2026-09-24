import { classifyArgs, isRange, isSymmetric, rangeEnds, type DiffArgs } from './diffArgs';
import { gitText, LocalGitError } from './gitRun';
import { INDEX_REF, WORKTREE_REF } from './localRefs';
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
  const sha = await commitOf(root, revs[0] ?? 'HEAD');
  const parent = await parentOf(root, sha);
  const base = tree(parent ?? (await emptyTree(root)));
  return { base, head: tree(sha), options, paths, commits: { exclude: parent, include: sha } };
}

async function planDiff(root: string, args: DiffArgs): Promise<DiffPlan> {
  const { base, head } = await diffSides(root, args);
  return { base, head, options: args.options, paths: args.paths, commits: await commitsBetween(root, base, head) };
}

function diffSides(root: string, args: DiffArgs): Promise<Sides> {
  const [first, second, ...extra] = args.revs;
  if (extra.length > 0) throw new LocalGitError(400, 'git diff takes at most two revisions');
  if (first !== undefined && second !== undefined) return uncached(args, () => commitSides(root, first, second));
  if (first !== undefined && isRange(first)) return uncached(args, () => rangeSides(root, first));
  return args.cached ? stagedSides(root, first) : worktreeSides(root, first);
}

function uncached(args: DiffArgs, sides: () => Promise<Sides>): Promise<Sides> {
  if (args.cached) throw new LocalGitError(400, '--cached compares the index with at most one commit');
  return sides();
}

async function commitSides(root: string, base: string, head: string): Promise<Sides> {
  return { base: tree(await commitOf(root, base)), head: tree(await commitOf(root, head)) };
}

async function rangeSides(root: string, range: string): Promise<Sides> {
  const [left = 'HEAD', right = 'HEAD'] = rangeEnds(range);
  const head = await commitOf(root, right);
  const base = isSymmetric(range) ? await mergeBase(root, left, right) : await commitOf(root, left);
  return { base: tree(base), head: tree(head) };
}

// With no commits yet, the index is compared against nothing, as git does.
async function stagedSides(root: string, rev: string | undefined): Promise<Sides> {
  const base = rev === undefined ? ((await headCommit(root)) ?? (await emptyTree(root))) : await commitOf(root, rev);
  return { base: tree(base), head: INDEX };
}

async function worktreeSides(root: string, rev: string | undefined): Promise<Sides> {
  return { base: rev === undefined ? INDEX : tree(await commitOf(root, rev)), head: WORKTREE };
}

async function commitsBetween(root: string, base: DiffSide, head: DiffSide): Promise<CommitRange | null> {
  if (base.kind !== 'tree') return null;
  const include = head.kind === 'tree' ? head.sha : await headCommit(root);
  return include === null || include === base.sha ? null : { exclude: base.sha, include };
}

function tree(sha: string): DiffSide {
  return { kind: 'tree', sha };
}

async function commitOf(root: string, rev: string): Promise<string> {
  const sha = await verified(root, `${rev}^{commit}`);
  if (sha === null) throw new LocalGitError(400, `Unknown revision: ${rev}`);
  return sha;
}

export function headCommit(root: string): Promise<string | null> {
  return verified(root, 'HEAD^{commit}');
}

function parentOf(root: string, sha: string): Promise<string | null> {
  return verified(root, `${sha}^1`);
}

async function verified(root: string, rev: string): Promise<string | null> {
  return gitText(root, ['rev-parse', '--verify', '--quiet', rev]).then(
    (output) => output.trim(),
    () => null,
  );
}

async function mergeBase(root: string, left: string, right: string): Promise<string> {
  const [base, head] = await Promise.all([commitOf(root, left), commitOf(root, right)]);
  const shared = await gitText(root, ['merge-base', base, head]).catch(() => '');
  if (shared.trim() === '') throw new LocalGitError(400, `${left} and ${right} share no history`);
  return shared.trim();
}

async function emptyTree(root: string): Promise<string> {
  return (await gitText(root, ['hash-object', '-t', 'tree', '/dev/null'])).trim();
}
