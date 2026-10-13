import { createElement } from 'react';
import { commentOrBlank, type CommentClass, type CommentStyle } from './foldComments';
import type { NodeSegment, SummarySegment } from './foldModel';

const SUMMARY_STYLE = {
  comment: 'text-ink-dim',
  specialComment: 'text-accent',
  specialCount: 'text-accent/70',
  keyword: 'text-ink-dim',
  count: 'text-ink',
  punctuation: 'text-ink-dim',
  module: 'text-ink',
} as const;

export const SPACE: NodeSegment = { kind: 'node', node: ' ', text: ' ' };

const SPECIAL_COMMENT = /\b(TODO|FIXME|NOTE|STUB|DEBUG|unimplemented!)/g;
const CONTENTLESS = /^[\s/*#\-{}]*$/;

export function styledText(text: string, style: keyof typeof SUMMARY_STYLE): NodeSegment {
  return { kind: 'node', node: createElement('span', { className: SUMMARY_STYLE[style] }, text), text };
}

/** The handle line, indent and all, so the summary sits at the code's own indentation. */
export function defaultSummary(lines: string[], handle: number): SummarySegment[] {
  return [{ kind: 'source', line: handle, start: 0, end: (lines[handle] ?? '').trimEnd().length }];
}

export function summaryText(summary: SummarySegment[], lines: string[]): string {
  return summary.map((segment) => segmentText(segment, lines)).join('');
}

function segmentText(segment: SummarySegment, lines: string[]): string {
  if (segment.kind === 'node') return segment.text;
  return (lines[segment.line] ?? '').slice(segment.start, segment.end);
}

export interface PrototypeSummary {
  line: number;
  segments: SummarySegment[];
}

/**
 * Port of Vanadium's prototype summary: skips comment lines, then lines of nothing but markers
 * like `{` or `//{{{`, and collapses runs of whitespace after the indent to one space.
 */
export function prototypeSummary(lines: string[], comments: CommentClass[], prototypeLine: number, endLine: number): PrototypeSummary {
  const line = skipCommentLines(comments, prototypeLine, endLine);
  return { line, segments: collapsedWhitespace(lines, line, skipContentlessLines(lines, line)) };
}

function skipCommentLines(comments: CommentClass[], line: number, endLine: number): number {
  let at = line;
  while (at < endLine && commentOrBlank(comments[at])) at += 1;
  return at >= endLine ? line : at;
}

function skipContentlessLines(lines: string[], line: number): number {
  let at = line;
  while (!isValidSummaryLine(lines[at] ?? '') && at + 1 < lines.length) at += 1;
  return at;
}

function isValidSummaryLine(text: string): boolean {
  return !CONTENTLESS.test(text);
}

function collapsedWhitespace(lines: string[], from: number, to: number): SummarySegment[] {
  const text = lines.slice(from, to + 1).join('\n');
  const segments: SummarySegment[] = [];
  const source = sourceRanges(lines, from);
  let start = 0;
  for (let at = text.length - text.trimStart().length; at < text.length; at += 1) {
    if (!/\s/.test(text[at] ?? '') || (text[at] === ' ' && !/\s/.test(text[at + 1] ?? ''))) continue;
    segments.push(...source(start, at), SPACE);
    start = text.length - text.slice(at).trimStart().length;
    at = start;
  }
  return [...segments, ...source(start, text.length)];
}

// Ranges of the joined text never cross a newline, since every newline collapses to a space.
function sourceRanges(lines: string[], from: number): (start: number, end: number) => SummarySegment[] {
  return (start, end) => {
    if (end <= start) return [];
    let line = from;
    let lineStart = 0;
    while (start > lineStart + (lines[line] ?? '').length) lineStart += (lines[line++] ?? '').length + 1;
    return [{ kind: 'source', line, start: start - lineStart, end: end - lineStart }];
  };
}

/** Port of Vanadium's special comments: counts of TODO, FIXME and friends found in the folded text. */
export function specialCommentSegments(text: string, style: CommentStyle): SummarySegment[] {
  const counts = new Map<string, number>();
  for (const [word] of text.matchAll(SPECIAL_COMMENT)) counts.set(word, (counts.get(word) ?? 0) + 1);
  if (counts.size === 0) return [];
  const segments: SummarySegment[] = [SPACE, styledText(style.startMarker, 'comment')];
  [...counts].forEach(([word, count], index) => {
    if (index > 0) segments.push(SPACE);
    if (count > 1) segments.push(styledText(`${count}x`, 'specialCount'));
    segments.push(styledText(word, 'specialComment'));
  });
  return style.endMarker ? [...segments, styledText(style.endMarker, 'comment')] : segments;
}

/** The comment's first line with real text; a leading `*` becomes `/*` so it still reads as a comment. */
export function summarizeBlockComment(lines: string[], first: number, last: number): SummarySegment[] {
  for (let line = first; line <= last; line += 1) {
    const text = lines[line] ?? '';
    if (!isValidSummaryLine(text)) continue;
    const indent = text.length - text.trimStart().length;
    if (text[indent] !== '*') return [{ kind: 'source', line, start: 0, end: text.length }];
    return [styledText('/*', 'comment'), { kind: 'source', line, start: indent + 1, end: text.length }];
  }
  return lines.slice(first, last + 1).map((text, offset) => ({ kind: 'source', line: first + offset, start: 0, end: text.length }));
}
