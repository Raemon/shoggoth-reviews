import type { ReactNode } from 'react';
import { codeSegments, type CodeSegment } from './codeSegments';
import type { SummaryLine, SummaryPiece } from './diffFolds';
import type { CharRange } from './intralineDiff';
import type { DiffRow } from './splitDiff';
import type { SideTokens } from './useDiffSideHighlight';

export type SummaryPart = { kind: 'code'; segments: CodeSegment[] } | { kind: 'node'; node: ReactNode };

/** Source pieces keep their own line's highlighting; emphasis from the summary diff is laid over them. */
export function summaryParts(summary: SummaryLine, side: 'left' | 'right', rows: DiffRow[], tokens: SideTokens | null): SummaryPart[] {
  let offset = 0;
  return summary.pieces.map((piece) => {
    const part = summaryPart(piece, offset, summary.emphasis, side, rows, tokens);
    offset += piece.kind === 'node' ? piece.text.length : piece.end - piece.start;
    return part;
  });
}

function summaryPart(
  piece: SummaryPiece,
  offset: number,
  emphasis: CharRange[] | null,
  side: 'left' | 'right',
  rows: DiffRow[],
  tokens: SideTokens | null,
): SummaryPart {
  if (piece.kind === 'node') return { kind: 'node', node: piece.node };
  const text = rows[piece.row]?.[side]?.text ?? '';
  const ranges = emphasis && shifted(emphasis, piece.start - offset);
  const segments = codeSegments(text, tokens?.[side][piece.row] ?? null, ranges);
  return { kind: 'code', segments: sliced(segments, piece.start, piece.end) };
}

function shifted(ranges: CharRange[], by: number): CharRange[] {
  return ranges.map((range) => ({ start: range.start + by, end: range.end + by }));
}

function sliced(segments: CodeSegment[], start: number, end: number): CodeSegment[] {
  let at = 0;
  return segments.flatMap((segment) => {
    const from = Math.max(start - at, 0);
    const to = Math.min(end - at, segment.content.length);
    at += segment.content.length;
    return to > from ? [{ ...segment, content: segment.content.slice(from, to) }] : [];
  });
}
