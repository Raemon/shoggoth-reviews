import type { DiffCell, DiffRow } from './splitDiff';
import type { Truncation } from './truncateRows';

export interface DiffLine {
  kind: DiffRow['kind'] | 'truncated';
  label: string;
  side: 'left' | 'right';
  cell: DiffCell | null;
  row: number;
  touched: boolean;
  blank: boolean;
  truncated: number;
}

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
  return lines.map((line) => (line.blank ? { ...line, blank: false } : line));
}

export function shownLines(lines: DiffLine[], hidden: Set<number>, truncation: Truncation): DiffLine[] {
  if (hidden.size === 0 && truncation.runOf.size === 0) return lines;
  const shown: DiffLine[] = [];
  const stripped = new Set<number>();
  for (const line of lines) keepLine(shown, stripped, line, hidden, truncation);
  return shown;
}

function keepLine(shown: DiffLine[], stripped: Set<number>, line: DiffLine, hidden: Set<number>, truncation: Truncation) {
  if (line.kind === 'hunk') return void shown.push(line);
  const run = truncation.runOf.get(line.row);
  if (run !== undefined) return addStripOnce(shown, stripped, run, truncation, line.side);
  if (!hidden.has(line.row)) shown.push(line);
}

function addStripOnce(shown: DiffLine[], stripped: Set<number>, run: number, truncation: Truncation, side: 'left' | 'right') {
  if (stripped.has(run)) return;
  stripped.add(run);
  shown.push(truncatedLine(run, side, truncation.sizeOf.get(run) ?? 0));
}

function truncatedLine(row: number, side: 'left' | 'right', truncated: number): DiffLine {
  return { kind: 'truncated', label: '', side, cell: null, row, touched: false, blank: false, truncated };
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
  const flags = { touched: row.touched === true, blank: blankRow(row), truncated: 0 };
  return { kind: row.kind, label: row.label, side, cell: row[side], row: index, ...flags };
}

// Judged per row, not per side, so both columns of a split diff stay aligned.
function blankRow(row: DiffRow): boolean {
  return row.kind !== 'hunk' && (row.left?.text ?? '') === '' && (row.right?.text ?? '') === '';
}
