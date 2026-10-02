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

export interface WholeRows {
  anchors: ReadonlyMap<number, { collapsed: boolean }>;
  edited: EditableBlock | null;
}

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
export function withSemiblanks(main: DiffLine[], left: DiffLine[], whole: WholeRows): [DiffLine[], DiffLine[]] {
  const mainKinds = columnKinds(main, whole);
  if (left.length === 0) return [marked(main, mainKinds), left];
  const leftKinds = columnKinds(left, whole);
  const agreed = mainKinds.map((kind, index) => agreedKind(kind, leftKinds[index]));
  return [marked(main, agreed), marked(left, agreed)];
}

function columnKinds(lines: DiffLine[], whole: WholeRows): CellKind[] {
  return lines.map((line, index) => cellKind(line, lines[index - 1], lines[index + 1], whole));
}

// A folded row needs its whole height for the fold's preview and badge.
function cellKind(line: DiffLine, above: DiffLine | undefined, below: DiffLine | undefined, whole: WholeRows): CellKind {
  if (!line.cell) return undefined;
  if (line.blank || whole.anchors.get(line.row)?.collapsed) return null;
  return semiblankKind(line.cell.text, hostText(line, above, whole), hostText(line, below, whole));
}

function hostText(line: DiffLine, neighbor: DiffLine | undefined, whole: WholeRows): string | null {
  if (!neighbor?.cell || !sameTint(line, neighbor, whole.anchors)) return null;
  return acrossEditorEdge(line, neighbor, whole.edited) ? null : neighbor.cell.text;
}

// Overhang into another tint would blur where a change or a fold ends.
function sameTint(line: DiffLine, neighbor: DiffLine, anchors: WholeRows['anchors']): boolean {
  return neighbor.kind === line.kind && neighbor.side === line.side && !anchors.get(neighbor.row)?.collapsed;
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
