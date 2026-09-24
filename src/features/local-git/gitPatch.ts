import type { ChangedFile } from '@/features/pull-requests/pullRequests';

export interface ParsedPatch {
  files: ChangedFile[];
  unmerged: string[];
}

interface Section {
  header: string[];
  hunks: string[];
}

const SECTION_START = /^diff --(?:git|cc|combined) /;
const COMBINED_START = /^diff --(?:cc|combined) /;
const GIT_START = 'diff --git ';
// "* Unmerged path" notes land between sections; only these prefixes belong to a hunk.
const HUNK_LINE = /^(?:@@|[ +\-\\])/;
const MAX_PATCH_CHARS = 1_000_000;
const QUOTED_PIECE = /\\(?:([0-7]{3})|(.))|([^\\]+)/gsu;
const ESCAPED: Record<string, number> = { a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13 };

export function parseGitPatch(output: string): ParsedPatch {
  const sections = splitSections(output.split('\n'));
  const combined = sections.filter((lines) => COMBINED_START.test(lines[0] ?? ''));
  const plain = sections.filter((lines) => !COMBINED_START.test(lines[0] ?? ''));
  return { files: mergeTypeChanges(plain.map(changedFileOf)), unmerged: combined.map(combinedPath) };
}

function splitSections(lines: string[]): string[][] {
  const sections: string[][] = [];
  for (const line of lines) {
    if (SECTION_START.test(line)) sections.push([line]);
    else sections[sections.length - 1]?.push(line);
  }
  return sections;
}

function divide(lines: string[]): Section {
  const start = lines.findIndex((line) => line.startsWith('@@'));
  if (start === -1) return { header: lines, hunks: [] };
  return { header: lines.slice(0, start), hunks: lines.slice(start).filter((line) => HUNK_LINE.test(line)) };
}

function changedFileOf(lines: string[]): ChangedFile {
  const { header, hunks } = divide(lines);
  const status = statusOf(header);
  const { from, to } = sectionPaths(header);
  return {
    filename: to,
    previousFilename: status === 'renamed' || status === 'copied' ? from : null,
    status,
    additions: countStarting(hunks, '+'),
    deletions: countStarting(hunks, '-'),
    patch: patchOf(hunks),
  };
}

function statusOf(header: string[]): string {
  if (hasLine(header, 'new file mode ')) return 'added';
  if (hasLine(header, 'deleted file mode ')) return 'removed';
  if (hasLine(header, 'rename from ')) return 'renamed';
  if (hasLine(header, 'copy from ')) return 'copied';
  return 'modified';
}

function sectionPaths(header: string[]): { from: string; to: string } {
  const named = gitLinePaths(header[0] ?? '');
  const from = movedPath(header, 'from') ?? sidePath(header, '--- ', 'a/') ?? named.from;
  const to = movedPath(header, 'to') ?? sidePath(header, '+++ ', 'b/') ?? named.to;
  return { from, to };
}

function movedPath(header: string[], end: 'from' | 'to'): string | null {
  const value = headerValue(header, `rename ${end} `) ?? headerValue(header, `copy ${end} `);
  return value === null ? null : unquote(value);
}

// Git appends a tab to names containing spaces; strip it to recover the name.
function sidePath(header: string[], marker: string, prefix: string): string | null {
  const value = headerValue(header, marker)?.replace(/\t$/, '');
  if (value === undefined || value === '/dev/null') return null;
  return withoutPrefix(unquote(value), prefix);
}

// Only reached when both sides name the same path, so an unquoted line splits in half.
function gitLinePaths(line: string): { from: string; to: string } {
  const rest = line.slice(GIT_START.length);
  if (rest.startsWith('"')) return quotedPair(rest);
  const half = (rest.length - 1) / 2;
  return { from: withoutPrefix(rest.slice(0, half), 'a/'), to: withoutPrefix(rest.slice(half + 1), 'b/') };
}

function quotedPair(rest: string): { from: string; to: string } {
  const end = closingQuote(rest);
  const second = rest.slice(end + 2);
  return { from: withoutPrefix(unquote(rest.slice(0, end + 1)), 'a/'), to: withoutPrefix(unquote(second), 'b/') };
}

function combinedPath(lines: string[]): string {
  return unquote((lines[0] ?? '').replace(COMBINED_START, ''));
}

function headerValue(header: string[], marker: string): string | null {
  const line = header.find((held) => held.startsWith(marker));
  return line === undefined ? null : line.slice(marker.length);
}

function hasLine(header: string[], marker: string): boolean {
  return header.some((line) => line.startsWith(marker));
}

function withoutPrefix(path: string, prefix: string): string {
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

function countStarting(hunks: string[], mark: string): number {
  return hunks.filter((line) => line.startsWith(mark)).length;
}

function patchOf(hunks: string[]): string | null {
  const patch = hunks.join('\n');
  return patch === '' || patch.length > MAX_PATCH_CHARS ? null : patch;
}

// A file<->symlink swap diffs as a removal plus an addition of the same path.
function mergeTypeChanges(files: ChangedFile[]): ChangedFile[] {
  const byName = new Map<string, ChangedFile>();
  for (const file of files) {
    const held = byName.get(file.filename);
    byName.set(file.filename, held ? typeChanged(held, file) : file);
  }
  return [...byName.values()];
}

function typeChanged(before: ChangedFile, after: ChangedFile): ChangedFile {
  const patches = [before.patch, after.patch].filter((patch) => patch !== null);
  return {
    ...after,
    status: 'changed',
    additions: before.additions + after.additions,
    deletions: before.deletions + after.deletions,
    patch: patches.length === 0 ? null : patches.join('\n'),
  };
}

function unquote(value: string): string {
  if (!value.startsWith('"')) return value;
  return decodeEscapes(value.slice(1, closingQuote(value)));
}

function closingQuote(value: string): number {
  let at = 1;
  while (at < value.length && value[at] !== '"') at += value[at] === '\\' ? 2 : 1;
  return at;
}

function decodeEscapes(body: string): string {
  return Buffer.from([...body.matchAll(QUOTED_PIECE)].flatMap(pieceBytes)).toString('utf8');
}

function pieceBytes([, octal, escape, plain]: RegExpMatchArray): number[] {
  if (octal) return [parseInt(octal, 8)];
  if (escape) return [ESCAPED[escape] ?? escape.charCodeAt(0)];
  return [...Buffer.from(plain ?? '', 'utf8')];
}
