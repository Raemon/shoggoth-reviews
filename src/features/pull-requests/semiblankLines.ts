import type { DiffLine } from './diffLines';
import { blockHasRow, type EditableBlock } from './editableBlocks';
import { leadingColumns, textColumns } from './rowHeights';

/** Half-height lines: brackets in a neighbor's indent, or comment marks squashed flat. */
export type SemiblankKind = 'up' | 'down' | 'comment';

const CLOSERS_ONLY = /^[\s,;]*[)\]}][\s,;)\]}]*$/u;
const OPENERS_ONLY = /^[\s,;]*[([{][\s,;([{]*$/u;
const COMMENT_MARKS_ONLY = /^\s*[/*#]+\s*$/u;
const STARS_ONLY = /^\s*\*+\s*$/u;
const BLOCK_COMMENT_LINE = /^\s*(\/\*|\*(\s|$))/u;

export const SEMIBLANK_CODE: Record<SemiblankKind, string> = {
  up: '-translate-y-1/2',
  down: 'relative',
  comment: 'origin-top scale-y-50',
};

// undefined: no cell, so the row's other cell decides.
type CellKind = SemiblankKind | null | undefined;

export function semiblankKind(text: string, above: string | null, below: string | null): SemiblankKind | null {
  if (commentMarksOnly(text, above)) return 'comment';
  if (CLOSERS_ONLY.test(text)) return fitsIndentOf(text, above) ? 'up' : null;
  if (OPENERS_ONLY.test(text)) return fitsIndentOf(text, below) ? 'down' : null;
  return null;
}

// Outside a block comment, lone stars are SQL, globs or Markdown rules.
function commentMarksOnly(text: string, above: string | null): boolean {
  if (!COMMENT_MARKS_ONLY.test(text)) return false;
  return !STARS_ONLY.test(text) || (above !== null && BLOCK_COMMENT_LINE.test(above));
}

function fitsIndentOf(text: string, host: string | null): boolean {
  return host !== null && host.trim() !== '' && leadingColumns(host) >= textColumns(text.trimEnd());
}

/** Split columns list rows in the same order; both cells of a row must agree. */
export function withSemiblanks(main: DiffLine[], left: DiffLine[], edited: EditableBlock | null): [DiffLine[], DiffLine[]] {
  const mainKinds = columnKinds(main, edited);
  if (left.length === 0) return [marked(main, mainKinds), left];
  const leftKinds = columnKinds(left, edited);
  const agreed = mainKinds.map((kind, index) => agreedKind(kind, leftKinds[index]));
  return [marked(main, agreed), marked(left, agreed)];
}

function columnKinds(lines: DiffLine[], edited: EditableBlock | null): CellKind[] {
  return lines.map((line, index) => cellKind(line, lines[index - 1], lines[index + 1], edited));
}

function cellKind(line: DiffLine, above: DiffLine | undefined, below: DiffLine | undefined, edited: EditableBlock | null): CellKind {
  if (!line.cell) return undefined;
  if (line.blank) return null;
  return semiblankKind(line.cell.text, hostText(line, above, edited), hostText(line, below, edited));
}

// A fold's summary line has no cell, so nothing tucks into it.
function hostText(line: DiffLine, neighbor: DiffLine | undefined, edited: EditableBlock | null): string | null {
  if (!neighbor?.cell || !sameTint(line, neighbor)) return null;
  return acrossEditorEdge(line, neighbor, edited) ? null : neighbor.cell.text;
}

// Overhang into another tint would blur where a change ends.
function sameTint(line: DiffLine, neighbor: DiffLine): boolean {
  return neighbor.kind === line.kind && neighbor.side === line.side;
}

// The editor hides the block on one side and puts a spacer after it on the other.
function acrossEditorEdge(line: DiffLine, neighbor: DiffLine, edited: EditableBlock | null): boolean {
  return edited !== null && blockHasRow(edited, line.row) !== blockHasRow(edited, neighbor.row);
}

function agreedKind(one: CellKind, other: CellKind): CellKind {
  if (one === undefined) return other;
  if (other === undefined) return one;
  return one === other ? one : null;
}

function marked(lines: DiffLine[], kinds: CellKind[]): DiffLine[] {
  return lines.map((line, index) => {
    const kind = kinds[index];
    return kind ? { ...line, semiblank: kind } : line;
  });
}
