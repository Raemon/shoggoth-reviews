import { extensionOf, foldDialect, type FoldDialect } from './foldDialects';
import type { FoldSource, FoldTag, SideFold } from './foldModel';
import { addRange, type Span } from './foldSpan';
import { defaultSummary } from './foldSummary';
import { commentLine, commentSpan, typeLikeSpan } from './regionRoles';

const GENERIC_KINDS = new Set(['block', 'statement_block', 'compound_statement', 'body_statement', 'declaration_list', 'class_body', 'do_block', 'field_declaration_list']);

/** Turns a method's raw spans into nested folds that take in the comments directly above them. */
export function assembleSideFolds(source: FoldSource, spans: Span[], importSource: Span[]): SideFold[] {
  const { lines } = source;
  const dialect = foldDialect(extensionOf(source.filename));
  const candidates = [...importSpans(lines, importSource, dialect.importLine), ...spans].filter(foldable);
  const nested = laminar(bestSpanByStart(candidates.map(untouching(candidates)).filter(foldable)));
  const edges = foldEdges(nested);
  const comments = commentLines(lines, spans, dialect);
  return nested.map((span) => sideFold(lines, span, headerStart(span, edges, comments)));
}

function foldable(span: Span): boolean {
  return span.end - span.start >= (span.imports ? 1 : 2);
}

// `} else {` ends one fold and opens the next; it stays visible as the second fold's handle.
function untouching(spans: Span[]): (span: Span) => Span {
  const starts = new Set(spans.map((span) => span.start));
  return (span) => (starts.has(span.end) ? { ...span, end: span.end - 1 } : span);
}

function bestSpanByStart(spans: Span[]): Span[] {
  const byStart = new Map<number, Span>();
  for (const span of spans) byStart.set(span.start, preferredSpan(byStart.get(span.start), span));
  return [...byStart.values()].sort((a, b) => a.start - b.start);
}

function preferredSpan(held: Span | undefined, candidate: Span): Span {
  if (!held) return candidate;
  if (candidate.end !== held.end) return candidate.end > held.end ? candidate : held;
  if (candidate.imports) return candidate;
  if (GENERIC_KINDS.has(held.kind) && !GENERIC_KINDS.has(candidate.kind)) return candidate;
  return held;
}

// Crossing folds can't both collapse cleanly, so the later-starting one goes.
function laminar(spans: Span[]): Span[] {
  const kept: Span[] = [];
  const open: Span[] = [];
  for (const span of spans) {
    while ((open[open.length - 1]?.end ?? Infinity) < span.start) open.pop();
    if ((open[open.length - 1]?.end ?? Infinity) < span.end) continue;
    open.push(span);
    kept.push(span);
  }
  return kept;
}

interface FoldEdges {
  firstEndingAt: Map<number, number>;
  lastStartingAt: Map<number, number>;
}

function foldEdges(spans: Span[]): FoldEdges {
  const firstEndingAt = new Map<number, number>();
  const lastStartingAt = new Map<number, number>();
  for (const span of spans) {
    firstEndingAt.set(span.end, Math.min(firstEndingAt.get(span.end) ?? Infinity, span.start));
    lastStartingAt.set(span.start, Math.max(lastStartingAt.get(span.start) ?? -1, span.end));
  }
  return { firstEndingAt, lastStartingAt };
}

// Stops short of any line that would leave another fold half inside this one.
function headerStart(span: Span, edges: FoldEdges, comments: Set<number>): number {
  if (commentSpan(span.kind)) return span.start;
  let start = span.start;
  let earliestStart = Infinity;
  for (let line = span.start - 1; comments.has(line); line -= 1) {
    if ((edges.lastStartingAt.get(line) ?? -1) >= span.start) break;
    earliestStart = Math.min(earliestStart, edges.firstEndingAt.get(line) ?? Infinity);
    if (earliestStart >= line) start = line;
  }
  return start;
}

function commentLines(lines: string[], spans: Span[], dialect: FoldDialect): Set<number> {
  const found = new Set<number>();
  lines.forEach((text, index) => {
    if (commentLine(text, dialect)) found.add(index);
  });
  for (const span of spans) if (commentSpan(span.kind)) addRange(found, span.start, span.end);
  return found;
}

function sideFold(lines: string[], span: Span, first: number): SideFold {
  return {
    first,
    last: span.end,
    handle: span.start,
    kind: span.kind,
    tags: spanTags(span, lines[span.start] ?? ''),
    summary: defaultSummary(lines, span.start),
  };
}

function spanTags(span: Span, handleText: string): FoldTag[] {
  const tags: FoldTag[] = [];
  if (span.imports) tags.push('imports');
  if (commentSpan(span.kind)) tags.push('comment');
  if (typeLikeSpan(span.kind, handleText)) tags.push('type');
  return tags;
}

function importSpans(lines: string[], tokens: Span[], importLine: RegExp | null): Span[] {
  if (!importLine) return [];
  return importRuns(lines, importCoveredLines(lines, tokens, importLine), importLine);
}

function importCoveredLines(lines: string[], spans: Span[], importLine: RegExp): Set<number> {
  const covered = new Set<number>();
  for (const span of spans) {
    if (importLine.test(lines[span.start] ?? '')) addRange(covered, span.start, span.end);
  }
  return covered;
}

interface ImportRun {
  start: number;
  last: number;
}

function importRuns(lines: string[], importCovered: Set<number>, importLine: RegExp): Span[] {
  const runs: Span[] = [];
  const run: ImportRun = { start: -1, last: -1 };
  lines.forEach((text, index) => importRunStep(text, index, importCovered, importLine, run, runs));
  flushImportRun(run, runs);
  return runs;
}

function importRunStep(text: string, index: number, importCovered: Set<number>, importLine: RegExp, run: ImportRun, runs: Span[]) {
  if (importCovered.has(index) || importLine.test(text)) {
    if (run.start < 0) run.start = index;
    run.last = index;
  } else if (run.start < 0 || text.trim() !== '') {
    flushImportRun(run, runs);
  }
}

function flushImportRun(run: ImportRun, runs: Span[]) {
  if (run.start >= 0 && run.last > run.start) runs.push({ start: run.start, end: run.last, kind: 'imports', imports: true });
  run.start = -1;
  run.last = -1;
}
