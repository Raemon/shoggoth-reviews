import { DIM_INK_STYLE, type CodeSegment, type DimmedSegment, type SegmentRole } from './codeSegments';
import type { ThemedToken } from './diffHighlight';
import { abbreviated, wordsToClip } from './keywordAbbreviations';

const DIM_OPACITY = 0.45;
const LEADING_SCOPES = /^(keyword|storage|punctuation|comment|meta\.brace)/;
const KEYWORD_SCOPES = /^(keyword|storage)/;

interface NameSpan {
  start: number;
  end: number;
}

type Explanation = NonNullable<ThemedToken['explanation']>[number];

interface GrammarPiece {
  content: string;
  scope: string;
}

export interface FoldLayout {
  indent: number;
  name: NameSpan;
  prefix: string;
}

export function foldLayout(tokens: ThemedToken[] | null): FoldLayout | null {
  const pieces = tokens && grammarPieces(tokens);
  const name = pieces && declaredName(pieces);
  if (!name) return null;
  const text = pieces.map((piece) => piece.content).join('');
  const indent = text.length - text.trimStart().length;
  return { indent, name, prefix: text.slice(indent, name.start) };
}

// Same-coloured grammar pieces merge into one token; theme-split halves share one explanation.
function grammarPieces(tokens: ThemedToken[]): GrammarPiece[] {
  const pieces: GrammarPiece[] = [];
  let shared: Explanation[] | undefined;
  let consumed = 0;
  for (const token of tokens) {
    if (token.explanation !== shared) [shared, consumed] = [token.explanation, 0];
    const own = shared ? sliceOf(shared, consumed, token.content.length) : [{ content: token.content, scope: '' }];
    pieces.push(...own);
    consumed += token.content.length;
  }
  return pieces;
}

function sliceOf(explanation: Explanation[], from: number, length: number): GrammarPiece[] {
  const pieces: GrammarPiece[] = [];
  let at = 0;
  for (const piece of explanation) {
    const content = piece.content.slice(Math.max(from - at, 0), Math.max(from + length - at, 0));
    if (content) pieces.push({ content, scope: piece.scopes[piece.scopes.length - 1]?.scopeName ?? '' });
    at += piece.content.length;
  }
  return pieces;
}

// The prefix is clipped only when its full words overflow the pane's prefix column.
export function collapsedSegments(segments: CodeSegment[], layout: FoldLayout | null, column: number): DimmedSegment[] {
  if (!layout) return segments;
  return roledSegments(segments, layout, wordsToClip(layout.prefix, column));
}

function roledSegments(segments: CodeSegment[], layout: FoldLayout, clip: ReadonlySet<string>): DimmedSegment[] {
  let offset = 0;
  return segments.flatMap((segment) => {
    const pieces = roleSlices(segment, offset, layout, clip);
    offset += segment.content.length;
    return pieces;
  });
}

// No keyword before the first word means no prefix (CSS selectors, YAML keys).
function declaredName(pieces: GrammarPiece[]): NameSpan | null {
  let at = 0;
  let keyworded = false;
  for (const piece of pieces) {
    if (namesTheBlock(piece)) return keyworded ? { start: at, end: at + piece.content.length } : null;
    keyworded ||= isKeyword(piece);
    at += piece.content.length;
  }
  return null;
}

function namesTheBlock({ content, scope }: GrammarPiece): boolean {
  return /\w/.test(content) && !LEADING_SCOPES.test(scope);
}

function isKeyword({ content, scope }: GrammarPiece): boolean {
  return /\w/.test(content) && KEYWORD_SCOPES.test(scope);
}

function roleSlices(segment: CodeSegment, start: number, layout: FoldLayout, clip: ReadonlySet<string>): DimmedSegment[] {
  const boundaries = [layout.indent, layout.name.start, layout.name.end];
  return slicesAt(segment.content, start, boundaries).flatMap(([from, to]) => {
    const piece = withRole(segment, segment.content.slice(from, to), roleAt(start + from, layout));
    return piece.role === 'prefix' && clip.size > 0 ? abbreviated(piece, clip) : [piece];
  });
}

function roleAt(position: number, { indent, name }: FoldLayout): SegmentRole | null {
  if (position < indent) return null;
  if (position < name.start) return 'prefix';
  return position < name.end ? 'name' : 'tail';
}

function withRole(segment: CodeSegment, content: string, role: SegmentRole | null): DimmedSegment {
  if (role === null) return { ...segment, content };
  if (role === 'name') return { ...segment, content, role };
  return { ...segment, content, role, style: DIM_INK_STYLE, opacity: DIM_OPACITY };
}

function slicesAt(text: string, start: number, points: number[]): [number, number][] {
  const inside = points.map((point) => point - start).filter((at) => at > 0 && at < text.length);
  const cuts = [...new Set(inside)].sort((a, b) => a - b);
  const bounds = [0, ...cuts, text.length];
  return cuts.concat(text.length).map((to, index) => [bounds[index] ?? 0, to]);
}
