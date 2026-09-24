import { lstat, readFile, readlink, realpath } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { gitBytes, gitText, LocalGitError, nulSeparated } from './gitRun';
import { INDEX_REF, WORKTREE_REF } from './localRefs';
import { repositoryRoot } from './localRepo';
import { fileBlobOf, fileTextOf, MAX_BLOB_BYTES, MAX_TEXT_BYTES, type FileBlob, type FileText } from '@/features/pull-requests/pullRequests';
import type { RepoFileSet } from '@/features/pull-requests/repoFiles';
import type { RepoLineCounts } from '@/features/pull-requests/repoLineCounts';

interface HeldBytes {
  bytes: Buffer | null;
  byteSize: number;
}

const MAX_LISTED_FILES = 100_000;
const GITLINK_MODE = '160000 ';

export async function readLocalText(repo: string, ref: string, path: string): Promise<FileText> {
  const { bytes, byteSize } = await readAtRef(await repositoryRoot(repo), ref, path, MAX_TEXT_BYTES);
  return bytes === null ? { text: null, byteSize } : fileTextOf(bytes);
}

export async function readLocalBlob(repo: string, ref: string, path: string): Promise<FileBlob> {
  const { bytes, byteSize } = await readAtRef(await repositoryRoot(repo), ref, path, MAX_BLOB_BYTES);
  return bytes === null ? { dataUrl: null, byteSize } : fileBlobOf(path, bytes);
}

export async function listLocalFiles(repo: string, ref: string = WORKTREE_REF): Promise<RepoFileSet> {
  const files = [...new Set(await filesAt(await repositoryRoot(repo), ref))].sort();
  return { sha: ref, files: files.slice(0, MAX_LISTED_FILES), truncated: files.length > MAX_LISTED_FILES };
}

export async function countLocalLines(repo: string, ref: string): Promise<RepoLineCounts> {
  const root = await repositoryRoot(repo);
  const output = await gitText(root, ['grep', '-I', '-c', '-z', ...grepTarget(ref), '--']).catch(() => '');
  return { lines: lineCounts(output, isSnapshot(ref) ? '' : `${ref}:`), tooLarge: false };
}

function grepTarget(ref: string): string[] {
  if (ref === WORKTREE_REF) return ['--untracked', '-e', ''];
  return ref === INDEX_REF ? ['--cached', '-e', ''] : ['-e', '', ref];
}

function isSnapshot(ref: string): boolean {
  return ref === WORKTREE_REF || ref === INDEX_REF;
}

function lineCounts(output: string, prefix: string): Record<string, number> {
  const counted = [...output.matchAll(/([^\0]*)\0(\d+)\n/g)];
  return Object.fromEntries(counted.map(([, path = '', count]) => [path.slice(prefix.length), Number(count)]));
}

function readAtRef(root: string, ref: string, path: string, maxBytes: number): Promise<HeldBytes> {
  if (ref === WORKTREE_REF) return readWorktree(root, path, maxBytes);
  return readObject(root, ref === INDEX_REF ? `:${path}` : `${ref}:${path}`, maxBytes);
}

async function readObject(root: string, object: string, maxBytes: number): Promise<HeldBytes> {
  const byteSize = Number((await gitText(root, ['cat-file', '-s', object])).trim());
  return readUpTo(byteSize, maxBytes, () => gitBytes(root, ['cat-file', 'blob', object]));
}

// Git stores a symlink as its target's path, so that is its content here too.
export async function readWorktree(root: string, path: string, maxBytes: number): Promise<HeldBytes> {
  const full = insideRoot(root, path);
  const info = await lstat(full).catch(() => null);
  if (info?.isSymbolicLink()) return readSymlink(full, maxBytes);
  if (!info?.isFile()) throw new LocalGitError(404, `${path} is not a file in the working tree`);
  await requireRealInside(root, full);
  return readUpTo(info.size, maxBytes, () => readFile(full));
}

async function readSymlink(full: string, maxBytes: number): Promise<HeldBytes> {
  const target = Buffer.from(await readlink(full));
  return readUpTo(target.length, maxBytes, async () => target);
}

async function readUpTo(byteSize: number, maxBytes: number, read: () => Promise<Buffer>): Promise<HeldBytes> {
  return { bytes: byteSize > maxBytes ? null : await read(), byteSize };
}

function insideRoot(root: string, path: string): string {
  const full = resolve(root, path);
  if (!full.startsWith(root + sep)) throw new LocalGitError(400, `${path} is outside the repository`);
  return full;
}

// A symlinked folder along the path could otherwise lead outside the repository.
async function requireRealInside(root: string, full: string): Promise<void> {
  const [realRoot, realFull] = await Promise.all([realpath(root), realpath(full)]);
  if (!realFull.startsWith(realRoot + sep)) throw new LocalGitError(400, `${full} is outside the repository`);
}

function filesAt(root: string, ref: string): Promise<string[]> {
  if (ref === WORKTREE_REF) return worktreeFiles(root);
  return ref === INDEX_REF ? trackedFiles(root) : treeFiles(root, ref);
}

async function worktreeFiles(root: string): Promise<string[]> {
  const [tracked, deleted, untracked] = await Promise.all([
    trackedFiles(root),
    gitText(root, ['ls-files', '-z', '--deleted']).then(nulSeparated),
    untrackedPaths(root, []),
  ]);
  const gone = new Set(deleted);
  return [...tracked.filter((path) => !gone.has(path)), ...untracked];
}

async function trackedFiles(root: string): Promise<string[]> {
  const staged = nulSeparated(await gitText(root, ['ls-files', '-z', '--cached', '--stage']));
  return staged.filter((entry) => !entry.startsWith(GITLINK_MODE)).map(afterTab);
}

async function treeFiles(root: string, sha: string): Promise<string[]> {
  const entries = nulSeparated(await gitText(root, ['ls-tree', '-r', '-z', sha]));
  return entries.filter((entry) => entry.split(' ')[1] === 'blob').map(afterTab);
}

export async function untrackedPaths(root: string, paths: string[]): Promise<string[]> {
  const listed = nulSeparated(await gitText(root, ['ls-files', '-z', '--others', '--exclude-standard', '--', ...paths]));
  return listed.filter((path) => !path.endsWith('/'));
}

function afterTab(entry: string): string {
  return entry.slice(entry.indexOf('\t') + 1);
}
