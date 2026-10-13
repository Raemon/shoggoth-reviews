import { extensionOf, foldDialect } from './foldDialects';
import type { FoldSource, SideFold, SummarySegment } from './foldModel';
import { foldContext, type FoldContext } from './foldRange';
import { addRange, type Span } from './foldSpan';
import { prototypeSummary, specialCommentSegments, summarizeBlockComment } from './foldSummary';
import { commentSpan, foldTags } from './regionRoles';

const GENERIC_KINDS = new Set(['block', 'statement_block', 'compound_statement', 'body_statement', 'declaration_list', 'class_body', 'do_block', 'field_declaration_list']);

/** Turns a method's raw spans into nested folds that take in the comments directly above them. */
export function assembleSideFolds(source: FoldSource, spans: Span[], importSource: Span[]): SideFold[] {
  const { lines } = source;
  const importLine = foldDialect(extensionOf(source.filename)).importLine;
  const candidates = [...importSpans(lines, importSource, importLine), ...spans].filter(foldable);
  const nested = laminar(bestSpanByStart(candidates.map(untouching(candidates)).filter(foldable)), spanRange);
  const edges = foldEdges(nested);
  const ctx = foldContext(lines, source.filename);
  const comments = commentLines(ctx, spans);
  return nested.map((span) => sideFold(ctx, span, headerStart(span, edges, comments)));
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

function spanRange(span: Span): [number, number] {
  return [span.start, span.end];
}

/**
 * What diff folds rely on from any fold method: folds of two or more lines that nest, with one
 * chevron per handle line.
 */
export function nestedFolds(folds: SideFold[]): SideFold[] {
  const ordered = folds.filter((fold) => fold.last > fold.first).sort((a, b) => a.first - b.first || b.last - a.last);
  return onePerHandle(laminar(ordered, (fold) => [fold.first, fold.last]));
}

// Sorted outermost first, so the fold kept for a handle is the widest.
function onePerHandle(folds: SideFold[]): SideFold[] {
  const seen = new Set<number>();
  return folds.filter((fold) => {
    if (seen.has(fold.handle)) return false;
    seen.add(fold.handle);
    return true;
  });
}

// Crossing folds can't both collapse cleanly, so the later-starting one goes. Takes items sorted by start.
function laminar<T>(items: T[], range: (item: T) => [number, number]): T[] {
  const kept: T[] = [];
  const open: number[] = [];
  for (const item of items) {
    const [start, end] = range(item);
    while ((open[open.length - 1] ?? Infinity) < start) open.pop();
    if ((open[open.length - 1] ?? Infinity) < end) continue;
    open.push(end);
    kept.push(item);
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

function commentLines(ctx: FoldContext, spans: Span[]): Set<number> {
  const found = new Set<number>();
  ctx.comments.forEach((comment, index) => {
    if (comment === 'comment') found.add(index);
  });
  for (const span of spans) if (commentSpan(span.kind)) addRange(found, span.start, span.end);
  return found;
}

function sideFold(ctx: FoldContext, span: Span, first: number): SideFold {
  const handleText = ctx.lines[span.start] ?? '';
  return { first, last: span.end, handle: span.start, kind: span.kind, tags: foldTags(span.kind, handleText), summary: spanSummary(ctx, span) };
}

function spanSummary(ctx: FoldContext, span: Span): SummarySegment[] {
  if (commentSpan(span.kind)) return summarizeBlockComment(ctx.lines, span.start, span.end);
  const { segments } = prototypeSummary(ctx.lines, ctx.comments, span.start, span.end);
  return [...segments, ...specialCommentSegments(ctx.lines.slice(span.start, span.end + 1).join('\n'), ctx.style)];
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
