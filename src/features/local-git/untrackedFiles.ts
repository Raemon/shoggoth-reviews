import { readWorktree, untrackedPaths } from './localFiles';
import type { ChangedFile } from '@/features/pull-requests/pullRequests';
import { mapWithWorkers } from '@/features/pull-requests/workerPool';

const MAX_UNTRACKED_FILES = 1000;
const MAX_PATCHED_BYTES = 1_000_000;
const BINARY_PROBE_BYTES = 8000;
const READ_WORKERS = 8;

// git diff leaves untracked files out, but a review of the working tree needs them.
export async function untrackedChanges(root: string, paths: string[]): Promise<ChangedFile[]> {
  const listed = (await untrackedPaths(root, paths)).slice(0, MAX_UNTRACKED_FILES);
  return mapWithWorkers(listed, READ_WORKERS, async (path) => addedFile(path, await readableText(root, path)));
}

async function readableText(root: string, path: string): Promise<string | null> {
  const { bytes } = await readWorktree(root, path, MAX_PATCHED_BYTES).catch(() => ({ bytes: null }));
  if (bytes === null || bytes.subarray(0, BINARY_PROBE_BYTES).includes(0)) return null;
  return bytes.toString('utf8');
}

function addedFile(filename: string, text: string | null): ChangedFile {
  const lines = text === null || text === '' ? [] : text.split('\n');
  const complete = lines[lines.length - 1] === '';
  const body = complete ? lines.slice(0, -1) : lines;
  return {
    filename,
    previousFilename: null,
    status: 'added',
    additions: body.length,
    deletions: 0,
    patch: body.length === 0 ? null : addedPatch(body, complete),
  };
}

function addedPatch(body: string[], complete: boolean): string {
  const header = `@@ -0,0 +1${body.length === 1 ? '' : `,${body.length}`} @@`;
  const ending = complete ? [] : ['\\ No newline at end of file'];
  return [header, ...body.map((line) => `+${line}`), ...ending].join('\n');
}
