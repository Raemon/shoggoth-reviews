import { readWorktree, untrackedPaths } from './localFiles';
import type { ChangedFile } from '@/features/pull-requests/pullRequests';
import { mapWithWorkers } from '@/features/pull-requests/workerPool';

const MAX_UNTRACKED_FILES = 1000;
const MAX_PATCHED_BYTES = 1_000_000;
const MAX_PATCHED_TOTAL = 16_000_000;
const BINARY_PROBE_BYTES = 8000;
const READ_WORKERS = 8;

export async function untrackedChanges(root: string, paths: string[]): Promise<ChangedFile[]> {
  const listed = (await untrackedPaths(root, paths)).slice(0, MAX_UNTRACKED_FILES);
  const budget = { left: MAX_PATCHED_TOTAL };
  return mapWithWorkers(listed, READ_WORKERS, async (path) => addedFile(path, await readableText(root, path, budget)));
}

async function readableText(root: string, path: string, budget: { left: number }): Promise<string | null> {
  if (budget.left <= 0) return null;
  const { bytes } = await readWorktree(root, path, Math.min(MAX_PATCHED_BYTES, budget.left)).catch(() => ({ bytes: null }));
  if (bytes === null || looksBinary(bytes)) return null;
  budget.left -= bytes.length;
  return bytes.toString('utf8');
}

function looksBinary(bytes: Buffer): boolean {
  return bytes.subarray(0, BINARY_PROBE_BYTES).includes(0);
}

function addedFile(filename: string, text: string | null): ChangedFile {
  const { body, complete } = textLines(text ?? '');
  const patch = body.length === 0 ? null : addedPatch(body, complete);
  return { filename, previousFilename: null, status: 'added', additions: body.length, deletions: 0, patch };
}

function textLines(text: string): { body: string[]; complete: boolean } {
  const lines = text === '' ? [] : text.split('\n');
  const complete = lines.at(-1) === '';
  return { body: complete ? lines.slice(0, -1) : lines, complete };
}

function addedPatch(body: string[], complete: boolean): string {
  const ending = complete ? [] : ['\\ No newline at end of file'];
  return [`@@ -0,0 +1,${body.length} @@`, ...body.map((line) => `+${line}`), ...ending].join('\n');
}
