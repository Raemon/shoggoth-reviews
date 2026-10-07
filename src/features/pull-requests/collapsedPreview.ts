import type { DiffFold } from './diffFolds';
import type { DiffRow } from './splitDiff';

const MAX_CHARS = 400;

/** The folded body after the handle line, flattened onto one line. */
export function collapsedPreview(rows: DiffRow[], fold: DiffFold, side: 'left' | 'right'): string {
  let preview = '';
  for (let index = fold.handle + 1; index <= fold.last; index += 1) {
    const piece = previewPiece(rows[index], side);
    if (!piece) continue;
    preview = preview ? `${preview} ${piece}` : piece;
    if (preview.length > MAX_CHARS) return `${preview.slice(0, MAX_CHARS)}…`;
  }
  return preview;
}

function previewPiece(row: DiffRow | undefined, side: 'left' | 'right'): string {
  if (!row || row.kind === 'hunk') return '';
  const text = row[side]?.text ?? row[side === 'right' ? 'left' : 'right']?.text;
  return text?.trim() ?? '';
}
