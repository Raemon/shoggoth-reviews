import { blankRow } from './diffLines';
import type { FoldAnchors } from './diffMetrics';
import type { DiffRow } from './splitDiff';

interface DrawnRow {
  row: number;
  blank: boolean;
  collapsed: boolean;
}

/** Blank rows beside drawn code, not ones wedged between two collapsed folds. */
export function openBlankRows(rows: DiffRow[], anchors: FoldAnchors, undrawn: ReadonlySet<number>): Set<number> {
  const drawn = drawnRows(rows, anchors, undrawn);
  const open = drawn.filter((drawnRow, at) => drawnRow.blank && !betweenFolds(drawn, at));
  return new Set(open.map((drawnRow) => drawnRow.row));
}

function drawnRows(rows: DiffRow[], anchors: FoldAnchors, undrawn: ReadonlySet<number>): DrawnRow[] {
  const described = rows.map((row, index) => ({ row: index, blank: blankRow(row), collapsed: anchors.get(index)?.collapsed === true }));
  return described.filter((drawnRow) => !undrawn.has(drawnRow.row));
}

function betweenFolds(drawn: DrawnRow[], at: number): boolean {
  return foldedBeside(drawn, at, -1) && foldedBeside(drawn, at, 1);
}

function foldedBeside(drawn: DrawnRow[], at: number, step: number): boolean {
  for (let index = at + step; index >= 0 && index < drawn.length; index += step) {
    const beside = drawn[index]!;
    if (!beside.blank) return beside.collapsed;
  }
  // Past the first or last drawn row there is nothing to read the blank line against.
  return true;
}
