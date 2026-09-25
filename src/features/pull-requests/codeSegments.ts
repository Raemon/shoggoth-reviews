import type { CSSProperties } from 'react';
import type { ThemedToken } from './diffHighlight';
import type { CharRange } from './intralineDiff';

export interface CodeSegment {
  content: string;
  style?: CSSProperties;
  emphasized: boolean;
  margin?: boolean;
}

export type SegmentRole = 'prefix' | 'name' | 'tail';

export interface DimmedSegment extends CodeSegment {
  opacity?: number;
  role?: SegmentRole;
  elided?: boolean;
}

export function codeSegments(
  text: string,
  lineTokens: ThemedToken[] | null,
  ranges: CharRange[] | null,
): CodeSegment[] {
  const colored = coloredPieces(text, lineTokens);
  if (!ranges?.length) return colored.map((piece) => ({ ...piece, emphasized: false }));
  return splitColoredByRanges(colored, ranges);
}

export function withMargins(segments: CodeSegment[], margins: CharRange[]): CodeSegment[] {
  if (!margins.length) return segments;
  let offset = 0;
  return segments.flatMap((segment) => {
    const parts = splitAtRanges(offset, segment.content, margins);
    offset += segment.content.length;
    return parts.map(({ content, inside }) => ({ ...segment, content, margin: inside }));
  });
}

const DECLARATION_WORDS = new Set([
  'export', 'import', 'default', 'function', 'interface', 'type', 'class', 'enum', 'namespace',
  'abstract', 'async', 'const', 'let', 'var', 'static', 'public', 'private', 'protected', 'readonly',
  'declare', 'extends', 'implements', 'def', 'fn', 'func', 'struct', 'impl', 'trait', 'module',
  'defmodule', 'defp', 'package', 'using', 'from',
]);

interface ShikiVarStyle extends CSSProperties {
  '--shiki-light'?: string;
  '--shiki-dark'?: string;
}

export const DIM_INK_STYLE: ShikiVarStyle = { '--shiki-light': 'var(--ink-dim)', '--shiki-dark': 'var(--ink-dim)' };

function coloredPieces(text: string, lineTokens: ThemedToken[] | null): { content: string; style?: CSSProperties }[] {
  return lineTokens?.length
    ? lineTokens.map((token) => ({ content: token.content, style: tokenStyle(token) }))
    : [{ content: text }];
}

function tokenStyle(token: ThemedToken): CSSProperties {
  if (DECLARATION_WORDS.has(token.content.trim())) return DIM_INK_STYLE;
  return token.htmlStyle as CSSProperties;
}

function splitColoredByRanges(
  colored: { content: string; style?: CSSProperties }[],
  ranges: CharRange[],
): CodeSegment[] {
  const segments: CodeSegment[] = [];
  let offset = 0;
  for (const piece of colored) {
    for (const part of splitAtRanges(offset, piece.content, ranges)) {
      segments.push({ content: part.content, style: piece.style, emphasized: part.inside });
    }
    offset += piece.content.length;
  }
  return segments;
}

function splitAtRanges(start: number, text: string, ranges: CharRange[]) {
  const parts: { content: string; inside: boolean }[] = [];
  let position = 0;
  while (position < text.length) {
    const absolute = start + position;
    const inside = ranges.find((range) => absolute >= range.start && absolute < range.end);
    const nextStart = ranges.find((range) => range.start > absolute)?.start ?? start + text.length;
    const stop = Math.min(text.length, (inside ? inside.end : nextStart) - start);
    parts.push({ content: text.slice(position, stop), inside: Boolean(inside) });
    position = stop;
  }
  return parts;
}
