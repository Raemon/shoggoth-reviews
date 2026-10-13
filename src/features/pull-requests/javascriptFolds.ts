import { delimiterParents, matchDelimiters, type DelimiterPair } from './delimiters';
import type { FoldMethod, FoldSource, SideFold } from './foldModel';
import {
  commentFold,
  foldContext,
  foldHeaderComments,
  foldImports,
  foldRange,
  mergeFolds,
  type FoldContext,
  type ImportLineClass,
  type ImportRules,
} from './foldRange';

export const javascriptFoldMethod: FoldMethod = { id: 'javascript', folds: javascriptFolds };

interface Delimiters {
  pairs: DelimiterPair[];
  parents: (number | null)[];
  byLine: DelimiterPair[][];
}

interface LineRange {
  start: number;
  end: number;
}

interface Candidate extends LineRange {
  kind: string;
}

const LARGE_BLOCK_LINES = 50;
const LARGE_COMMENT_LINES = 10;
const MAX_IMPORT_LINES = 50;
const BRACKET_DEPTH: Record<string, number> = { '{': 1, '(': 1, '[': 1, '}': -1, ')': -1, ']': -1 };
const CLASS = /\bclass\b/;
const FUNCTION = /\bfunction\b/;
const STRING_DIRECTIVE = /^(["'])[^"']*\1\s*;?\s*$/;
const STRING_LITERAL = /(["'])((?:\\.|(?!\1).)*)\1/g;

const JS_IMPORTS: ImportRules = { label: 'import', classify: classifyImportLine, findEnd: findImportEndLine, moduleOf: moduleOfImport };

/**
 * Port of Vanadium's JavascriptFolding.NewFoldMethod. Candidates come from `{{{`/`}}}` and `{{_}}`
 * markers, lines that declare a class or function or hold an arrow, and the children of any
 * top-level bracket pair of 50+ lines; each widens over the brackets on its first and last lines.
 * Header comments, the import block and long loose comments fold too.
 */
export function javascriptFolds(source: FoldSource): SideFold[] {
  const ctx = foldContext(source.lines, source.filename);
  const delimiters = delimiterIndex(ctx);
  const candidates = [...markerFolds(ctx, delimiters), ...lengthHeuristicFolds(delimiters), ...entityTriggerFolds(ctx, delimiters)];
  const imports = foldImports(ctx, JS_IMPORTS);
  const header = [...foldHeaderComments(ctx, isHeaderPrologueLine), ...(imports ? [imports] : [])];
  const soFar = mergeFolds(header, candidateFolds(ctx, candidates));
  return mergeFolds(soFar, largeCommentFolds(ctx, soFar));
}

function delimiterIndex(ctx: FoldContext): Delimiters {
  const pairs = ctx.scan ? matchDelimiters(ctx.scan) : [];
  const byLine: DelimiterPair[][] = ctx.lines.map(() => []);
  for (const pair of pairs) {
    byLine[pair.openLine]?.push(pair);
    if (pair.closeLine !== pair.openLine) byLine[pair.closeLine]?.push(pair);
  }
  return { pairs, parents: delimiterParents(pairs), byLine };
}

// `{{_}}` folds the brackets its line opens; `{{{` and `}}}` fold everything between them.
function markerFolds(ctx: FoldContext, { byLine }: Delimiters): Candidate[] {
  const found: Candidate[] = [];
  const open: number[] = [];
  ctx.lines.forEach((text, line) => {
    const keyLine = text.includes('{{_}}') ? expandOverDelimiters(byLine, line, line) : null;
    if (keyLine && keyLine.end > keyLine.start) found.push({ kind: 'marker', ...keyLine });
    const opened = text.includes('}}}') ? open.pop() : undefined;
    if (opened !== undefined) found.push({ kind: 'marker', start: opened, end: line });
    if (text.includes('{{{')) open.push(line);
  });
  return found;
}

// In a long top-level block (a big object, or a `describe(…)`), each child folds.
function lengthHeuristicFolds({ pairs, parents, byLine }: Delimiters): Candidate[] {
  const large = new Set(pairs.flatMap((pair, index) => (parents[index] === null && pairLines(pair) >= LARGE_BLOCK_LINES ? [index] : [])));
  return pairs.flatMap((pair, index) => {
    const parent = parents[index];
    if (parent === null || parent === undefined || !large.has(parent)) return [];
    return [{ kind: 'block', ...expandOverDelimiters(byLine, pair.openLine, pair.closeLine) }];
  });
}

function pairLines(pair: DelimiterPair): number {
  return pair.closeLine - pair.openLine + 1;
}

// A class or function whose `{` isn't on its own line may have it on the next.
function entityTriggerFolds(ctx: FoldContext, { byLine }: Delimiters): Candidate[] {
  return ctx.lines.flatMap((text, line) => {
    const kind = triggerKind(text);
    if (kind === null) return [];
    if (kind === 'lambda') return [{ kind, ...expandOverDelimiters(byLine, line, line) }];
    const next = ctx.lines[line + 1];
    if (next === undefined) return [];
    const end = !text.includes('{') && next.includes('{') ? line + 1 : line;
    return [{ kind, ...expandOverDelimiters(byLine, line, end) }];
  });
}

function triggerKind(text: string): string | null {
  if (CLASS.test(text)) return 'class';
  if (FUNCTION.test(text)) return 'function';
  return text.includes('=>') ? 'lambda' : null;
}

// Grows the range until no bracket on its first line opens earlier, or on its last line closes later.
function expandOverDelimiters(byLine: DelimiterPair[][], start: number, end: number): LineRange {
  let first = start;
  for (let earlier = earliestOpenLine(byLine, first); earlier !== first; earlier = earliestOpenLine(byLine, first)) first = earlier;
  let last = end;
  for (let later = latestCloseLine(byLine, last); later !== last; later = latestCloseLine(byLine, last)) last = later;
  return { start: first, end: last };
}

function earliestOpenLine(byLine: DelimiterPair[][], line: number): number {
  return (byLine[line] ?? []).reduce((earliest, pair) => Math.min(earliest, pair.openLine), line);
}

function latestCloseLine(byLine: DelimiterPair[][], line: number): number {
  return (byLine[line] ?? []).reduce((latest, pair) => Math.max(latest, pair.closeLine), line);
}

// A fold must span three lines, and less than half the file.
function candidateFolds(ctx: FoldContext, candidates: Candidate[]): SideFold[] {
  const half = Math.floor(ctx.lines.length / 2);
  const sized = candidates.filter(({ start, end }) => end - start > 1 && end - start < half);
  return mergeFolds(sized.flatMap(({ kind, start, end }) => foldRange(ctx, kind, start, start, end) ?? []));
}

// A comment of ten or more lines that no other fold took in folds on its own.
function largeCommentFolds(ctx: FoldContext, folds: SideFold[]): SideFold[] {
  const { lines, comments } = ctx;
  const folded = new Uint8Array(lines.length);
  for (const fold of folds) folded.fill(1, fold.first, fold.last + 1);
  const found: SideFold[] = [];
  lines.forEach((_text, line) => {
    if (comments[line] !== 'comment' || comments[line - 1] === 'comment') return;
    let length = 1;
    while (line + length < lines.length && comments[line + length] === 'comment' && !folded[line + length]) length += 1;
    if (length >= LARGE_COMMENT_LINES) found.push(commentFold(ctx, line, line + length - 1));
  });
  return found;
}

export function classifyImportLine(index: number, text: string): ImportLineClass {
  const trimmed = text.trim();
  if (isImportStatementStart(trimmed)) return 'import';
  if (index === 0 && trimmed.startsWith('#!')) return 'prologue';
  return STRING_DIRECTIVE.test(trimmed) ? 'directive' : 'other';
}

/** Directives and the shebang don't end the file header, so a comment after them is still a header comment. */
export function isHeaderPrologueLine(index: number, text: string): boolean {
  const kind = classifyImportLine(index, text);
  return kind === 'directive' || kind === 'prologue';
}

// `importantThing()` and `imports.foo()` aren't imports.
function isImportStatementStart(trimmed: string): boolean {
  return trimmed.startsWith('import') && !/[\w$.]/.test(trimmed[6] ?? ' ');
}

interface ImportLineScan {
  depth: number;
  endsWithComma: boolean;
}

/**
 * An import continues while a bracket is open or a line ends in a comma. An unterminated (or
 * implausibly long) one is taken as a single line, so it can't swallow the file.
 */
export function findImportEndLine(lines: string[], start: number): number {
  const scan: ImportLineScan = { depth: 0, endsWithComma: false };
  for (let line = start; line < lines.length && line - start < MAX_IMPORT_LINES; line += 1) {
    scanImportLine(lines[line] ?? '', scan);
    if (scan.depth <= 0 && !scan.endsWithComma) return line;
  }
  return start;
}

// A line without code (a comment, say) leaves `endsWithComma` as it was.
function scanImportLine(text: string, scan: ImportLineScan) {
  let lastCode = '';
  for (let at = 0; at < text.length; at += 1) {
    const char = text[at] ?? '';
    if (char === "'" || char === '"' || char === '`') {
      at = closingQuote(text, at);
      lastCode = char;
    } else if (text.startsWith('//', at)) break;
    else if (text.startsWith('/*', at)) {
      const close = text.indexOf('*/', at + 2);
      if (close < 0) break;
      at = close + 1;
    } else if (char.trim() !== '') {
      scan.depth += BRACKET_DEPTH[char] ?? 0;
      lastCode = char;
    }
  }
  if (lastCode) scan.endsWithComma = lastCode === ',';
}

function closingQuote(text: string, at: number): number {
  let close = at + 1;
  while (close < text.length && text[close] !== text[at]) close += text[close] === '\\' ? 2 : 1;
  return close;
}

/** The module an import names, for the fold summary: its last string literal. */
export function moduleOfImport(statement: string): string {
  const literals = [...statement.matchAll(STRING_LITERAL)];
  return literals[literals.length - 1]?.[2] ?? (statement.split('\n')[0] ?? '').trim();
}
