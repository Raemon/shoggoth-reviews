import { foldMethodFor } from './foldMethods';
import type { FoldTag, NodeSegment, Side, SideFold, SourceSegment, SummarySegment } from './foldModel';
import { defaultSummary, summaryText } from './foldSummary';
import { intralineRanges, type CharRange } from './intralineDiff';
import { nestedFolds } from './sideFolds';
import type { DiffRow } from './splitDiff';

/** One side's complete file, with the diff row each line is drawn on. */
export interface SideFile {
  lines: string[];
  rows: number[];
}

type SideFiles = Record<Side, SideFile>;

export type SummaryPiece = { kind: 'source'; row: number; start: number; end: number } | NodeSegment;

export interface SummaryLine {
  text: string;
  pieces: SummaryPiece[];
  /** File line number of the first source piece, for the gutter. */
  line: number | null;
  emphasis: CharRange[] | null;
}

/** A fold placed on diff rows; folds from both sides with the same first and last rows are linked. */
export interface DiffFold {
  key: string;
  first: number;
  last: number;
  handle: number;
  side: Side;
  left: SideFold | null;
  right: SideFold | null;
  /** From the fold on the side that owns it. */
  kind: string;
  foldedLines: number;
  tags: FoldTag[];
  summaries: Record<Side, SummaryLine | null>;
  summaryChanged: boolean;
  addedLines: number;
  deletedLines: number;
}

interface Pair {
  left: SideFold | null;
  right: SideFold | null;
}

export function computeDiffFolds(rows: DiffRow[], filename: string): DiffFold[] | Promise<DiffFold[]> {
  const left = sideFile(rows, 'left');
  const right = sideFile(rows, 'right');
  if (!left || !right) return [];
  const files = { left, right };
  const method = foldMethodFor(filename);
  const found = [method.folds({ filename, lines: left.lines }), method.folds({ filename, lines: right.lines })] as const;
  if (Array.isArray(found[0]) && Array.isArray(found[1])) return diffFolds(rows, files, nestedFolds(found[0]), nestedFolds(found[1]));
  return Promise.all(found).then(([leftFolds, rightFolds]) => diffFolds(rows, files, nestedFolds(leftFolds), nestedFolds(rightFolds)));
}

/** Null when the side's lines aren't all there, numbered from 1, in order. */
export function sideFile(rows: DiffRow[], side: Side): SideFile | null {
  const file: SideFile = { lines: [], rows: [] };
  for (const [index, row] of rows.entries()) {
    const cell = row[side];
    if (!cell) continue;
    if (cell.line !== file.lines.length + 1) return null;
    file.lines.push(cell.text);
    file.rows.push(index);
  }
  return file;
}

export function allLinesDeleted(rows: DiffRow[]): boolean {
  return rows.some((row) => row.left) && rows.every((row) => !row.right);
}

export function diffFolds(rows: DiffRow[], files: SideFiles, left: SideFold[], right: SideFold[]): DiffFold[] {
  const pairs = pairFolds(withDeletedFileFold(left, files), right, files);
  return nonCrossing(pairs.map((pair) => diffFold(rows, files, pair)));
}

// A deleted file collapses to a single line.
function withDeletedFileFold(folds: SideFold[], files: SideFiles): SideFold[] {
  const { lines } = files.left;
  if (files.right.lines.length > 0 || lines.length < 3) return folds;
  const whole: SideFold = { first: 0, last: lines.length - 1, handle: 0, kind: 'file', tags: [], summary: defaultSummary(lines, 0) };
  return [whole, ...folds.filter((fold) => fold.handle !== 0)];
}

function pairFolds(left: SideFold[], right: SideFold[], files: SideFiles): Pair[] {
  const unmatched = new Map(left.map((fold) => [rowBounds(fold, files.left), fold]));
  const pairs = right.map((fold) => {
    const bounds = rowBounds(fold, files.right);
    const match = unmatched.get(bounds) ?? null;
    unmatched.delete(bounds);
    return { left: match, right: fold };
  });
  return [...pairs, ...[...unmatched.values()].map((fold) => ({ left: fold, right: null }))];
}

function rowBounds(fold: SideFold, file: SideFile): string {
  return `${file.rows[fold.first]}:${file.rows[fold.last]}`;
}

// Each side's folds nest, so only a left-only fold can cut across another; it gives way.
function nonCrossing(folds: DiffFold[]): DiffFold[] {
  const kept = folds.filter((fold) => fold.right);
  const leftOnly = folds.filter((fold) => !fold.right && !kept.some((other) => crosses(fold, other)));
  return [...kept, ...leftOnly];
}

function crosses(a: DiffFold, b: DiffFold): boolean {
  return startsInside(a, b) || startsInside(b, a);
}

function startsInside(outer: DiffFold, inner: DiffFold): boolean {
  return outer.first < inner.first && inner.first <= outer.last && outer.last < inner.last;
}

function diffFold(rows: DiffRow[], files: SideFiles, pair: Pair): DiffFold {
  const side: Side = pair.right ? 'right' : 'left';
  const own = pair[side] as SideFold;
  const placed = files[side].rows;
  const first = placed[own.first] ?? 0;
  const last = placed[own.last] ?? first;
  return {
    key: `${spanKey(pair.left)}|${spanKey(pair.right)}`,
    first,
    last,
    handle: placed[own.handle] ?? first,
    side,
    left: pair.left,
    right: pair.right,
    kind: own.kind,
    foldedLines: own.last - own.first + 1,
    tags: [...new Set([...(pair.left?.tags ?? []), ...(pair.right?.tags ?? [])])],
    ...foldSummaries(pair, files),
    addedLines: changedLines(rows, first, last, 'right'),
    deletedLines: changedLines(rows, first, last, 'left'),
  };
}

function spanKey(fold: SideFold | null): string {
  return fold ? `${fold.first}-${fold.last}` : 'x';
}

function changedLines(rows: DiffRow[], first: number, last: number, side: Side): number {
  let count = 0;
  for (let row = first; row <= last; row += 1) if (rows[row]?.kind === 'change' && rows[row]?.[side]) count += 1;
  return count;
}

// The two summaries are diffed like a changed line, so a fold reads as unchanged only when they match.
function foldSummaries(pair: Pair, files: SideFiles): Pick<DiffFold, 'summaries' | 'summaryChanged'> {
  const left = pair.left && summaryLine(pair.left.summary, files.left);
  const right = pair.right && summaryLine(pair.right.summary, files.right);
  if (!left || !right) return { summaries: { left, right }, summaryChanged: true };
  if (left.text === right.text) return { summaries: { left, right }, summaryChanged: false };
  const ranges = intralineRanges(left.text, right.text);
  return {
    summaries: { left: { ...left, emphasis: ranges?.before ?? null }, right: { ...right, emphasis: ranges?.after ?? null } },
    summaryChanged: true,
  };
}

function placedPiece({ line, start, end }: SourceSegment, file: SideFile): SummaryPiece {
  return { kind: 'source', row: file.rows[line] ?? -1, start, end };
}

function summaryLine(summary: SummarySegment[], file: SideFile): SummaryLine {
  const firstSource = summary.find((segment) => segment.kind === 'source');
  return {
    text: summaryText(summary, file.lines),
    pieces: summary.map((segment) => (segment.kind === 'node' ? segment : placedPiece(segment, file))),
    line: firstSource ? firstSource.line + 1 : null,
    emphasis: null,
  };
}
