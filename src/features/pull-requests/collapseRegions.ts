import { extensionOf, foldDialect, type FoldDialect } from './foldDialects';
import { indentSpans, lineRuleSpans, markdownSpans } from './foldLineSpans';
import { addRowRange, allLinesDeleted, pushSpan, scanRows, scanRowsFlushing, scanSide, textOf, type Side, type Span } from './foldSpan';
import { commentLine, commentSpan, functionLikeSpan, typeLikeSpan } from './regionRoles';
import type { DiffRow } from './splitDiff';

export interface CollapseRegion {
  start: number;
  end: number;
  key: string;
  kind: string;
  depth: number;
  imports: boolean;
  comment: boolean;
  typeLike: boolean;
  functionLike: boolean;
  addedLines: number;
  deletedLines: number;
  anchorChanged: boolean;
}

export function collapseRegions(rows: DiffRow[], contiguous: boolean, filename: string): CollapseRegion[] {
  const side = scanSide(rows);
  const dialect = foldDialect(extensionOf(filename));
  const { spans: tokens, covered } = dialect.tokens ? tokenSpans(rows, side, contiguous, dialect) : emptyTokenScan();
  const spans = [
    ...tokens,
    ...lineRuleSpans(rows, side, contiguous, dialect.lineRules, covered),
    ...(dialect.markdown ? markdownSpans(rows, side, contiguous) : []),
    ...(dialect.indent ? indentSpans(rows, side, contiguous, covered) : []),
  ];
  return assembleRegions(rows, side, contiguous, spans, tokens, covered, dialect);
}

export function assembleRegions(
  rows: DiffRow[],
  side: Side,
  contiguous: boolean,
  spans: Span[],
  importSource: Span[],
  literal: Set<number>,
  dialect: FoldDialect,
): CollapseRegion[] {
  const imports = importSpans(rows, side, contiguous, importSource, dialect.importLine);
  const comments = commentGroupSpans(rows, side, contiguous, literal, dialect);
  const wideEnough = spans.filter((span) => span.end - span.start >= 2);
  return finalize(rows, [...imports, ...comments, ...wideEnough, ...deletedFileSpans(rows)]);
}

// Block comments arrive as token spans; this catches the runs of line comments they miss.
function commentGroupSpans(rows: DiffRow[], side: Side, contiguous: boolean, literal: Set<number>, dialect: FoldDialect): Span[] {
  const runs: Span[] = [];
  const run: LineRun = { start: -1, last: -1 };
  const flush = () => flushRun(run, runs, 'comment_group');
  scanRowsFlushing(rows, side, contiguous, flush, (text, index) => {
    if (!literal.has(index) && commentLine(text, dialect)) extendRun(run, index);
    else flush();
  });
  return runs;
}

function contentRowIndexes(rows: DiffRow[]): number[] {
  return rows.flatMap((row, index) => (row.kind === 'hunk' ? [] : [index]));
}

function deletedFileSpans(rows: DiffRow[]): Span[] {
  const lines = contentRowIndexes(rows);
  const start = lines[0];
  const end = lines[lines.length - 1];
  if (!allLinesDeleted(rows) || start === undefined || end === undefined || end - start < 2) return [];
  return [{ start, end, kind: 'file', imports: false }];
}

function importSpans(rows: DiffRow[], side: Side, contiguous: boolean, tokens: Span[], importLine: RegExp | null): Span[] {
  if (!importLine) return [];
  return importRuns(rows, side, importCoveredRows(rows, side, tokens, importLine), importLine, contiguous);
}

interface ScanState {
  blockClose: string | null;
  inTemplate: boolean;
  interpolation: number;
  triple: string | null;
  heredoc: string | null;
  heredocNext: string | null;
  deadBranch: number;
  dialect: FoldDialect;
}

interface OpenBracket {
  open: string;
  row: number;
}

interface OpenTag {
  name: string;
  row: number;
}

interface PendingTag {
  name: string;
  row: number;
  depth: number;
}

type SpanKind = 'comment' | 'template' | 'string';

interface Scan {
  state: ScanState;
  brackets: OpenBracket[];
  tags: OpenTag[];
  pendings: PendingTag[];
  opened: Partial<Record<SpanKind, number>>;
}

interface TokenScan {
  spans: Span[];
  covered: Set<number>;
}

type Token =
  | { t: 'bracket'; char: string }
  | { t: 'tagStart'; name: string }
  | { t: 'tagClose'; name: string }
  | { t: 'gt' }
  | { t: 'selfGt' }
  | { t: 'tagBreak' }
  | { t: 'spanStart'; kind: SpanKind }
  | { t: 'spanEnd'; kind: SpanKind };

const CLOSE_TO_OPEN: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

function emptyTokenScan(): TokenScan {
  return { spans: [], covered: new Set<number>() };
}

function tokenSpans(rows: DiffRow[], side: Side, contiguous: boolean, dialect: FoldDialect): TokenScan {
  const result = emptyTokenScan();
  let scan = newScan(dialect);
  scanRows(
    rows,
    side,
    contiguous,
    () => {
      scan = newScan(dialect);
    },
    (text, index) => {
      for (const token of tokensIn(text, scan.state)) applyToken(token, index, scan, result);
    },
  );
  return result;
}

function newScan(dialect: FoldDialect): Scan {
  return {
    state: { blockClose: null, inTemplate: false, interpolation: 0, triple: null, heredoc: null, heredocNext: null, deadBranch: 0, dialect },
    brackets: [],
    tags: [],
    pendings: [],
    opened: {},
  };
}

function applyToken(token: Token, row: number, scan: Scan, result: TokenScan) {
  if (token.t === 'bracket') {
    trackPendingDepth(scan, token.char);
    applyBracket(token.char, row, scan.brackets, result.spans);
  } else if (token.t === 'tagStart') {
    scan.pendings.push({ name: token.name, row, depth: 0 });
  } else if (token.t === 'tagClose') {
    scan.pendings.length = 0;
    closeTag(token.name, row, scan.tags, result.spans);
  } else if (token.t === 'spanStart') {
    scan.opened[token.kind] = row;
  } else if (token.t === 'spanEnd') {
    endOpenedSpan(token.kind, row, scan, result);
  } else {
    resolvePendingTag(token.t, row, scan, result.spans);
  }
}

function endOpenedSpan(kind: SpanKind, row: number, scan: Scan, result: TokenScan) {
  const start = scan.opened[kind];
  delete scan.opened[kind];
  if (start === undefined) return;
  pushSpan(result.spans, start, row, kind);
  addRowRange(result.covered, start + 1, row);
}

function trackPendingDepth(scan: Scan, char: string) {
  const delta = char in CLOSE_TO_OPEN ? -1 : 1;
  for (const pending of scan.pendings) pending.depth += delta;
  if (scan.pendings.some((pending) => pending.depth < 0)) {
    scan.pendings = scan.pendings.filter((pending) => pending.depth >= 0);
  }
}

function resolvePendingTag(kind: 'gt' | 'selfGt' | 'tagBreak', row: number, scan: Scan, spans: Span[]) {
  if (kind === 'tagBreak') {
    while ((scan.pendings[scan.pendings.length - 1]?.depth ?? 1) <= 0) scan.pendings.pop();
    return;
  }
  const pending = scan.pendings[scan.pendings.length - 1];
  if (!pending || pending.depth > 0) return;
  if (kind === 'gt') scan.tags.push({ name: pending.name, row: pending.row });
  if (kind === 'selfGt') pushSpan(spans, pending.row, row, 'element');
  scan.pendings.pop();
}

function applyBracket(bracket: string, row: number, stack: OpenBracket[], spans: Span[]) {
  const expected = CLOSE_TO_OPEN[bracket];
  if (!expected) {
    stack.push({ open: bracket, row });
    return;
  }
  const top = stack.pop();
  if (!top || top.open !== expected) {
    stack.length = 0;
    return;
  }
  pushSpan(spans, top.row, row, 'block');
}

function closeTag(name: string, row: number, tags: OpenTag[], spans: Span[]) {
  for (let index = tags.length - 1; index >= 0; index -= 1) {
    const open = tags[index];
    if (!open || open.name !== name) continue;
    pushSpan(spans, open.row, row, 'element');
    tags.length = index;
    return;
  }
}

function tokensIn(text: string, state: ScanState): Token[] {
  const found: Token[] = [];
  if (state.heredoc) return heredocLine(text, state, found);
  if (state.dialect.preprocessor && deadBranchLine(text, state)) return found;
  let at = 0;
  while (at < text.length) {
    if (state.blockClose) at = pastBlockComment(text, at, state, found);
    else if (state.triple) at = pastTriple(text, at, state, found);
    else if (state.inTemplate && state.interpolation === 0) at = pastTemplate(text, at, state, found);
    else at = plainCode(text, at, state, found);
  }
  if (state.heredocNext) {
    state.heredoc = state.heredocNext;
    state.heredocNext = null;
  }
  return found;
}

function heredocLine(text: string, state: ScanState, found: Token[]): Token[] {
  if (text.trim() === state.heredoc) {
    state.heredoc = null;
    found.push({ t: 'spanEnd', kind: 'string' });
  }
  return found;
}

function deadBranchLine(text: string, state: ScanState): boolean {
  if (state.deadBranch > 0) {
    if (/^\s*#\s*if(n?def)?\b/.test(text)) state.deadBranch += 1;
    else if (/^\s*#\s*endif\b/.test(text)) state.deadBranch -= 1;
    else if (state.deadBranch === 1 && /^\s*#\s*(else|elif)\b/.test(text)) state.deadBranch = 0;
    return true;
  }
  if (/^\s*#\s*if\s+0\b/.test(text)) {
    state.deadBranch = 1;
    return true;
  }
  return false;
}

function pastMarkedSpan(text: string, at: number, close: string, kind: SpanKind, found: Token[]): number | null {
  const end = text.indexOf(close, at);
  if (end < 0) return null;
  found.push({ t: 'spanEnd', kind });
  return end + close.length;
}

function pastBlockComment(text: string, at: number, state: ScanState, found: Token[]): number {
  const next = pastMarkedSpan(text, at, state.blockClose ?? '', 'comment', found);
  if (next !== null) state.blockClose = null;
  return next ?? text.length;
}

function pastTriple(text: string, at: number, state: ScanState, found: Token[]): number {
  const next = pastMarkedSpan(text, at, state.triple ?? '', 'string', found);
  if (next !== null) state.triple = null;
  return next ?? text.length;
}

function pastTemplate(text: string, at: number, state: ScanState, found: Token[]): number {
  for (let scan = at; scan < text.length; scan += 1) {
    if (text[scan] === '\\') scan += 1;
    else if (text[scan] === '`') {
      state.inTemplate = false;
      found.push({ t: 'spanEnd', kind: 'template' });
      return scan + 1;
    } else if (text[scan] === '$' && text[scan + 1] === '{') {
      state.interpolation = 1;
      found.push({ t: 'bracket', char: '{' });
      return scan + 2;
    }
  }
  return text.length;
}

function plainCode(text: string, at: number, state: ScanState, found: Token[]): number {
  const char = text[at] ?? '';
  const pair = char + (text[at + 1] ?? '');
  if (lineCommentStarts(text, at, pair, state)) return text.length;
  if (pair === '/*') return startBlockComment(state, found, '*/', at + 2);
  if (state.dialect.markup && text.startsWith('<!--', at)) return startBlockComment(state, found, '-->', at + 4);
  if (state.dialect.regexLiterals && char === '/' && pair !== '/>') {
    const past = regexToken(text, at);
    if (past !== null) return past;
  }
  if (state.dialect.triples && (char === '"' || char === "'") && text.startsWith(char.repeat(3), at)) {
    return startTriple(text, at, char, state, found);
  }
  if (state.dialect.heredocs && pair === '<<') return startHeredoc(text, at, state, found);
  if (char === "'" || char === '"') return endOfSpan(text, at + 1, char) ?? at + 1;
  if (char === '`') return startTemplate(text, at, state, found);
  if ('()[]{}'.includes(char)) return bracketChar(char, at, state, found);
  if (state.dialect.markup) return markupCode(text, at, pair, found);
  return at + 1;
}

function startBlockComment(state: ScanState, found: Token[], close: string, next: number): number {
  state.blockClose = close;
  found.push({ t: 'spanStart', kind: 'comment' });
  return next;
}

function regexToken(text: string, at: number): number | null {
  if (!regexCanStart(text, at)) return null;
  let inClass = false;
  for (let scan = at + 1; scan < text.length; scan += 1) {
    const char = text[scan];
    if (char === '\\') scan += 1;
    else if (char === '[') inClass = true;
    else if (char === ']') inClass = false;
    else if (char === '/' && !inClass) return scan + 1;
  }
  return null;
}

function regexCanStart(text: string, at: number): boolean {
  const before = text.slice(0, at).trimEnd();
  if (before === '') return true;
  const last = before[before.length - 1] ?? '';
  return '=(,:;!&|?[{'.includes(last) || /\breturn$/.test(before);
}

function startTriple(text: string, at: number, quote: string, state: ScanState, found: Token[]): number {
  const triple = quote.repeat(3);
  const end = text.indexOf(triple, at + 3);
  if (end >= 0) return end + 3;
  state.triple = triple;
  found.push({ t: 'spanStart', kind: 'string' });
  return text.length;
}

const HEREDOC_START = /^<<<?[-~]?(["']?)([A-Za-z_]\w*)\1/;

function startHeredoc(text: string, at: number, state: ScanState, found: Token[]): number {
  if (at > 0 && /[\w)\]'"]/.test(text[at - 1] ?? '')) return at + 2;
  const terminator = text.slice(at).match(HEREDOC_START)?.[2];
  if (terminator === undefined) return at + 2;
  state.heredocNext = terminator;
  found.push({ t: 'spanStart', kind: 'string' });
  return text.length;
}

function startTemplate(text: string, at: number, state: ScanState, found: Token[]): number {
  if (state.interpolation > 0) return endOfSpan(text, at + 1, '`') ?? text.length;
  state.inTemplate = true;
  found.push({ t: 'spanStart', kind: 'template' });
  return at + 1;
}

function bracketChar(char: string, at: number, state: ScanState, found: Token[]): number {
  if (state.interpolation > 0) {
    if (char === '{') state.interpolation += 1;
    else if (char === '}') state.interpolation -= 1;
  }
  found.push({ t: 'bracket', char });
  return at + 1;
}

const TAG_CLOSE = /^<\/\s*([A-Za-z][\w.:$-]*)?\s*>/;
const TAG_START = /^<([A-Za-z][\w.:$-]*)/;

function markupCode(text: string, at: number, pair: string, found: Token[]): number {
  if (pair === '/>') {
    found.push({ t: 'selfGt' });
    return at + 2;
  }
  if (text[at] === '<') return tagToken(text, at, found);
  if (text[at] === '>' && text[at - 1] !== '=') found.push({ t: 'gt' });
  else if (text[at] === ';' || text[at] === '?') found.push({ t: 'tagBreak' });
  return at + 1;
}

function tagToken(text: string, at: number, found: Token[]): number {
  const rest = text.slice(at);
  const close = rest.match(TAG_CLOSE);
  if (close) {
    found.push({ t: 'tagClose', name: close[1] ?? '' });
    return at + close[0].length;
  }
  if (rest.startsWith('<>')) {
    found.push({ t: 'tagStart', name: '' }, { t: 'gt' });
    return at + 2;
  }
  const name = rest.match(TAG_START)?.[1];
  if (name !== undefined) found.push({ t: 'tagStart', name });
  return at + (name === undefined ? 1 : name.length + 1);
}

function lineCommentStarts(text: string, at: number, pair: string, state: ScanState): boolean {
  const { slashComments, dashComments, hashComments } = state.dialect;
  return (
    (slashComments && pair === '//' && notUrlScheme(text, at)) ||
    (dashComments && pair === '--') ||
    (hashComments && lineCommentHash(text, at))
  );
}

function notUrlScheme(text: string, at: number): boolean {
  return text[at - 1] !== ':';
}

function lineCommentHash(text: string, at: number): boolean {
  return text[at] === '#' && (at === 0 || /\s/.test(text[at - 1] ?? ''));
}

function endOfSpan(text: string, at: number, close: string): number | null {
  for (let scan = at; scan < text.length; scan += 1) {
    if (text[scan] === '\\') scan += 1;
    else if (text[scan] === close) return scan + 1;
  }
  return null;
}

function importCoveredRows(rows: DiffRow[], side: Side, spans: Span[], importLine: RegExp): Set<number> {
  const covered = new Set<number>();
  for (const span of spans) {
    if (!importLine.test(textOf(rows[span.start], side) ?? '')) continue;
    addRowRange(covered, span.start, span.end);
  }
  return covered;
}

interface LineRun {
  start: number;
  last: number;
}

function importRuns(rows: DiffRow[], side: Side, importCovered: Set<number>, importLine: RegExp, contiguous: boolean): Span[] {
  const runs: Span[] = [];
  const run: LineRun = { start: -1, last: -1 };
  scanRowsFlushing(
    rows,
    side,
    contiguous,
    () => flushRun(run, runs, 'imports'),
    (text, index) => importRunStep(text, index, importCovered, importLine, run, runs),
  );
  return runs;
}

function importRunStep(text: string, index: number, importCovered: Set<number>, importLine: RegExp, run: LineRun, runs: Span[]) {
  if (importCovered.has(index) || importLine.test(text)) extendRun(run, index);
  else if (run.start < 0 || text.trim() !== '') flushRun(run, runs, 'imports');
}

function extendRun(run: LineRun, index: number) {
  if (run.start < 0) run.start = index;
  run.last = index;
}

function flushRun(run: LineRun, runs: Span[], kind: 'imports' | 'comment_group') {
  if (run.start >= 0 && run.last > run.start) runs.push({ start: run.start, end: run.last, kind, imports: kind === 'imports' });
  run.start = -1;
  run.last = -1;
}

function finalize(rows: DiffRow[], spans: Span[]): CollapseRegion[] {
  const ordered = [...bestSpanByStart(spans).values()].sort((a, b) => a.start - b.start);
  const openEnds: number[] = [];
  return ordered.map((span) => regionOf(rows, span, enterDepth(openEnds, span)));
}

function bestSpanByStart(spans: Span[]): Map<number, Span> {
  const byStart = new Map<number, Span>();
  for (const span of spans) byStart.set(span.start, preferredSpan(byStart.get(span.start), span));
  return byStart;
}

function enterDepth(openEnds: number[], span: Span): number {
  while (openEnds.length > 0 && (openEnds[openEnds.length - 1] ?? 0) < span.start) openEnds.pop();
  const depth = openEnds.length;
  openEnds.push(span.end);
  return depth;
}

const GENERIC_KINDS = new Set(['block', 'statement_block', 'compound_statement', 'body_statement', 'declaration_list', 'class_body', 'do_block', 'field_declaration_list']);

function changedLineCount(rows: DiffRow[], side: Side): number {
  return rows.filter((row) => row.kind === 'change' && row[side]).length;
}

function preferredSpan(held: Span | undefined, candidate: Span): Span {
  if (!held) return candidate;
  if (candidate.end !== held.end) return candidate.end > held.end ? candidate : held;
  if (candidate.imports) return candidate;
  if (GENERIC_KINDS.has(held.kind) && !GENERIC_KINDS.has(candidate.kind)) return candidate;
  return held;
}

function anchorText(anchor: DiffRow | undefined): string {
  return anchor?.right?.text ?? anchor?.left?.text ?? '';
}

function regionOf(rows: DiffRow[], span: Span, depth: number): CollapseRegion {
  const anchor = rows[span.start];
  const hidden = rows.slice(span.start + 1, span.end + 1);
  return {
    ...span,
    depth,
    key: `${anchor?.left?.line ?? 'x'}:${anchor?.right?.line ?? 'x'}`,
    comment: commentSpan(span.kind),
    typeLike: typeLikeSpan(span.kind, anchorText(anchor)),
    functionLike: functionLikeSpan(span.kind, anchorText(anchor)),
    addedLines: changedLineCount(hidden, 'right'),
    deletedLines: changedLineCount(hidden, 'left'),
    anchorChanged: anchor?.kind === 'change',
  };
}
