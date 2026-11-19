import { blankRow } from './diffLines';
import type { DiffRow } from './splitDiff';

type Anchors = ReadonlyMap<number, { collapsed: boolean }>;

interface BlankSurroundings {
  rows: DiffRow[];
  anchors: Anchors;
}

/** Blank rows beside drawn code, not ones wedged between two collapsed folds. */
export function openBlankRows(rows: DiffRow[], anchors: Anchors, undrawn: ReadonlySet<number>): Set<number> {
  const drawn = rows.flatMap((_row, index) => (undrawn.has(index) ? [] : [index]));
  const where = { rows, anchors };
  return new Set(drawn.filter((row, at) => blankRow(rows[row]!) && !betweenFolds(drawn, at, where)));
}

function betweenFolds(drawn: number[], at: number, where: BlankSurroundings): boolean {
  return foldedBeside(drawn, at, -1, where) && foldedBeside(drawn, at, 1, where);
}

// Past the first or last drawn row there is nothing to read the blank line against.
function foldedBeside(drawn: number[], at: number, step: number, { rows, anchors }: BlankSurroundings): boolean {
  for (let index = at + step; index >= 0 && index < drawn.length; index += step) {
    const row = drawn[index]!;
    if (!blankRow(rows[row]!)) return anchors.get(row)?.collapsed === true;
  }
  return true;
}
