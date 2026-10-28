import type { ChangedFile } from './pullRequests';
import { WHOLE_FILE_STATUS } from './wholeFileEntry';

// Past this a file takes seconds to highlight or parse, so nothing loads it unasked.
export const LARGE_FILE_BYTES = 256 * 1024;

// GitHub's limits for how much of one file's diff loads before it is asked for.
const SHOWN_PATCH_LINES = 400;
const SHOWN_PATCH_CHARS = 20 * 1024;

export function largeDiffPaths(files: ChangedFile[]): ReadonlySet<string> {
  return new Set(files.filter(isLargeDiff).map((file) => file.filename));
}

// A browsed whole file was opened by name, so it is shown whatever its size.
function isLargeDiff(file: ChangedFile): boolean {
  if (!file.patch || file.status === WHOLE_FILE_STATUS) return false;
  return file.patch.length > SHOWN_PATCH_CHARS || patchLineCount(file.patch) > SHOWN_PATCH_LINES;
}

export function patchLineCount(patch: string): number {
  let count = 1;
  for (let at = patch.indexOf('\n'); at !== -1; at = patch.indexOf('\n', at + 1)) count += 1;
  return count;
}
