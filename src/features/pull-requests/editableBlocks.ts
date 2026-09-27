import type { DiffRow } from './splitDiff';

export interface EditableBlock {
  firstRow: number;
  lastRow: number;
  startLine: number;
  endLine: number;
  caretLine: number;
  text: string;
}

export function blockHasRow(block: EditableBlock, row: number): boolean {
  return row >= block.firstRow && row <= block.lastRow;
}

export interface BlockBounds {
  hidden: Set<number>;
  stopAtBlankLines: boolean;
}

export function editableBlockAt(rows: DiffRow[], index: number, bounds: BlockBounds): EditableBlock | null {
  const span = editableRowSpan(rows, index, bounds);
  return span ? blockFromRightCells(rows, span.firstRow, span.lastRow, index) : null;
}

function editableRowSpan(rows: DiffRow[], index: number, bounds: BlockBounds): { firstRow: number; lastRow: number } | null {
  const inBlock = (at: number) => withinHunk(rows[at]) && !bounds.hidden.has(at) && !endsBlock(rows[at], bounds);
  if (!inBlock(index)) return null;
  let firstRow = index;
  let lastRow = index;
  while (inBlock(firstRow - 1)) firstRow -= 1;
  while (inBlock(lastRow + 1)) lastRow += 1;
  return { firstRow, lastRow };
}

// Without blank-line stops, a fold-free whole-file view is one block for the whole file.
function endsBlock(row: DiffRow | undefined, bounds: BlockBounds): boolean {
  return bounds.stopAtBlankLines && row?.kind === 'context' && (row.right?.text ?? '').trim() === '';
}

function blockFromRightCells(rows: DiffRow[], firstRow: number, lastRow: number, caretIndex: number): EditableBlock | null {
  const cells = rows.slice(firstRow, lastRow + 1).flatMap((row) => (row.right ? [row.right] : []));
  const first = cells[0];
  const last = cells[cells.length - 1];
  if (!first || !last || last.line - first.line + 1 !== cells.length) return null;
  return {
    firstRow,
    lastRow,
    startLine: first.line,
    endLine: last.line,
    caretLine: rows.slice(firstRow, caretIndex).filter((row) => row.right).length,
    text: cells.map((cell) => cell.text.replace(/\r$/, '')).join('\n'),
  };
}

export function hunkHasEditableLines(rows: DiffRow[], hunkRow: number): boolean {
  for (let index = hunkRow + 1; withinHunk(rows[index]); index += 1) {
    if (rows[index]?.right) return true;
  }
  return false;
}

function withinHunk(row: DiffRow | undefined): boolean {
  return row !== undefined && row.kind !== 'hunk';
}

function changedCharacters(before: string, after: string): { removed: string; added: string } {
  const was = [...before];
  const now = [...after];
  let start = 0;
  while (start < was.length && start < now.length && was[start] === now[start]) start += 1;
  let end = 0;
  while (
    end < was.length - start &&
    end < now.length - start &&
    was[was.length - 1 - end] === now[now.length - 1 - end]
  ) {
    end += 1;
  }
  return { removed: was.slice(start, was.length - end).join(''), added: now.slice(start, now.length - end).join('') };
}

const MESSAGE_SNIPPET = 60;

export function commitMessageFor(pull: { title: string; number: number }, before: string, after: string): string {
  const { removed, added } = changedCharacters(before, after);
  const title = pull.title.replace(/\s+/g, ' ').trim();
  return `Minor change to ${title} (#${pull.number}): ${snippet(removed)} -> ${snippet(added)}`;
}

function snippet(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat === '') return '(nothing)';
  return flat.length > MESSAGE_SNIPPET ? `${flat.slice(0, MESSAGE_SNIPPET - 1)}…` : flat;
}
