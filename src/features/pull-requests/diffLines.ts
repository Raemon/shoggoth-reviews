import type { SummaryLine } from './diffFolds';
import type { SemiblankKind } from './semiblankLines';
import type { DiffCell, DiffRow } from './splitDiff';
import type { Truncation } from './truncateRows';
import type { FoldControl } from './useCodeCollapse';

export interface DiffLine {
  kind: DiffRow['kind'] | 'truncated' | 'fold';
  label: string;
  side: 'left' | 'right';
  cell: DiffCell | null;
  row: number;
  touched: boolean;
  blank: boolean;
  /** A blank line between two collapsed folds, drawn as a thin rule. */
  betweenFolds: boolean;
  semiblank: SemiblankKind | null;
  truncated: number;
  fold: FoldLine | null;
}

/** A collapsed fold's stand-in; a null summary pads a split column whose side has none. */
export interface FoldLine {
  control: FoldControl;
  summary: SummaryLine | null;
  /** Carries the chevron and badge: the line on the side that owns the fold. */
  primary: boolean;
}

export type Column = 'left' | 'right' | 'unified' | 'result';

interface PlacedRow {
  row: DiffRow;
  index: number;
}

export function columnLines(rows: DiffRow[], side: 'left' | 'right'): DiffLine[] {
  return rows.map((row, index) => lineOf(row, index, side));
}

export function unifiedLines(rows: DiffRow[]): DiffLine[] {
  return changeRuns(rows).flatMap(runLines);
}

// Commented removed lines stay: hiding them would make an open thread vanish silently.
export function resultLines(rows: DiffRow[], commented: Set<number>): DiffLine[] {
  return columnLines(rows, 'right').filter((line) => keptInResult(line, commented));
}

function keptInResult(line: DiffLine, commented: Set<number>): boolean {
  return line.kind === 'hunk' || line.cell !== null || commented.has(line.row);
}

export function asOrdinaryLines(lines: DiffLine[]): DiffLine[] {
  return lines.map((line) => (line.blank && !line.betweenFolds ? { ...line, blank: false } : line));
}

export function withFoldSeparators(lines: DiffLine[]): DiffLine[] {
  if (!lines.some((line) => line.fold)) return lines;
  return lines.map((line, index) => (line.blank && foldsAround(lines, index) ? { ...line, betweenFolds: true } : line));
}

function foldsAround(lines: DiffLine[], index: number): boolean {
  return Boolean(nearestUnblank(lines, index, -1)?.fold && nearestUnblank(lines, index, 1)?.fold);
}

function nearestUnblank(lines: DiffLine[], index: number, step: 1 | -1): DiffLine | undefined {
  let at = index + step;
  while (lines[at]?.blank) at += step;
  return lines[at];
}

interface Placed {
  strips: Set<number>;
  folds: Set<FoldControl>;
}

export function shownLines(lines: DiffLine[], column: Column, folded: Map<number, FoldControl>, truncation: Truncation): DiffLine[] {
  if (folded.size === 0 && truncation.runOf.size === 0) return lines;
  const shown: DiffLine[] = [];
  const placed: Placed = { strips: new Set(), folds: new Set() };
  for (const line of lines) keepLine(shown, placed, line, column, folded, truncation);
  return shown;
}

function keepLine(shown: DiffLine[], placed: Placed, line: DiffLine, column: Column, folded: Map<number, FoldControl>, truncation: Truncation) {
  if (line.kind === 'hunk') return void shown.push(line);
  const run = truncation.runOf.get(line.row);
  if (run !== undefined) return addStripOnce(shown, placed.strips, run, truncation, line.side);
  const fold = folded.get(line.row);
  if (!fold) return void shown.push(line);
  if (placed.folds.has(fold)) return;
  placed.folds.add(fold);
  shown.push(...foldLines(fold, column));
}

// A unified column draws one line for matching summaries, and a removed/added pair otherwise.
function foldLines(control: FoldControl, column: Column): DiffLine[] {
  const { summaries, summaryChanged } = control.fold;
  if (column === 'left' || column === 'right') return [foldLine(control, column)];
  if (column === 'result' || !summaryChanged) return [foldLine(control, summaries.right ? 'right' : 'left')];
  return (['left', 'right'] as const).filter((side) => summaries[side]).map((side) => foldLine(control, side));
}

function foldLine(control: FoldControl, side: 'left' | 'right'): DiffLine {
  const fold = { control, summary: control.fold.summaries[side], primary: side === control.fold.side };
  return { ...placeholderLine('fold', control.fold.first, side), fold };
}

function addStripOnce(shown: DiffLine[], stripped: Set<number>, run: number, truncation: Truncation, side: 'left' | 'right') {
  if (stripped.has(run)) return;
  stripped.add(run);
  shown.push(truncatedLine(run, side, truncation.sizeOf.get(run) ?? 0));
}

function truncatedLine(row: number, side: 'left' | 'right', truncated: number): DiffLine {
  return { ...placeholderLine('truncated', row, side), truncated };
}

function placeholderLine(kind: 'truncated' | 'fold', row: number, side: 'left' | 'right'): DiffLine {
  return { kind, label: '', side, cell: null, row, touched: false, blank: false, betweenFolds: false, semiblank: null, truncated: 0, fold: null };
}

function changeRuns(rows: DiffRow[]): PlacedRow[][] {
  const runs: PlacedRow[][] = [];
  rows.forEach((row, index) => {
    const open = runs[runs.length - 1];
    if (row.kind === 'change' && open?.[0]?.row.kind === 'change') open.push({ row, index });
    else runs.push([{ row, index }]);
  });
  return runs;
}

function runLines(run: PlacedRow[]): DiffLine[] {
  if (run[0]?.row.kind !== 'change') return run.map(({ row, index }) => lineOf(row, index, 'right'));
  return [...sideLines(run, 'left'), ...sideLines(run, 'right')];
}

function sideLines(run: PlacedRow[], side: 'left' | 'right'): DiffLine[] {
  return run.filter(({ row }) => row[side]).map(({ row, index }) => lineOf(row, index, side));
}

function lineOf(row: DiffRow, index: number, side: 'left' | 'right'): DiffLine {
  const flags = { touched: row.touched === true, blank: blankRow(row), betweenFolds: false, semiblank: null, truncated: 0, fold: null };
  return { kind: row.kind, label: row.label, side, cell: row[side], row: index, ...flags };
}

// Judged per row, not per side, so both columns of a split diff stay aligned.
function blankRow(row: DiffRow): boolean {
  return row.kind !== 'hunk' && (row.left?.text ?? '') === '' && (row.right?.text ?? '') === '';
}
