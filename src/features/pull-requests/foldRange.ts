import { backtrackOverComments, classifyCommentLines, commentStyleFor, type CommentClass, type CommentStyle } from './foldComments';
import type { SideFold, SummarySegment } from './foldModel';
import { prototypeSummary, SPACE, specialCommentSegments, styledText, summarizeBlockComment } from './foldSummary';
import type { ScannedText } from './partialTokenizer';
import { foldTags } from './regionRoles';

/** What Vanadium's shared fold builders know about one side's file. */
export interface FoldContext {
  lines: string[];
  comments: CommentClass[];
  style: CommentStyle;
  scan: ScannedText | null;
}

export function foldContext(lines: string[], filename: string): FoldContext {
  const style = commentStyleFor(filename);
  return { lines, style, ...classifyCommentLines(lines, style) };
}

/**
 * Port of Vanadium's FoldUtil.FoldRange: folds `startLine` through `endLine`, along with the comment
 * directly above. The summary is the prototype line plus any special comments inside the fold.
 */
export function foldRange(ctx: FoldContext, kind: string, prototypeLine: number, startLine: number, endLine: number): SideFold | null {
  const first = ctx.comments[startLine] === 'comment' ? startLine : backtrackOverComments(ctx.comments, startLine);
  if (first === endLine) return null;
  const { line, segments } = prototypeSummary(ctx.lines, ctx.comments, prototypeLine, endLine);
  const folded = ctx.lines.slice(startLine, endLine + 1).join('\n');
  const summary = [...segments, ...specialCommentSegments(folded, ctx.style)];
  return { first, last: endLine, handle: line, kind, tags: foldTags(kind, ctx.lines[line] ?? ''), summary };
}

export function commentFold(ctx: FoldContext, first: number, last: number): SideFold {
  return { first, last, handle: first, kind: 'comment', tags: ['comment'], summary: summarizeBlockComment(ctx.lines, first, last) };
}

/**
 * Port of FoldUtil.FoldHeaderComments: each comment block at the top of the file, before the first
 * code. A prologue line (a shebang, say) doesn't end the header.
 */
export function foldHeaderComments(ctx: FoldContext, isPrologueLine?: (index: number, text: string) => boolean): SideFold[] {
  const { lines, comments } = ctx;
  const folds: SideFold[] = [];
  let commentStart = 0;
  for (let line = 0; line < lines.length; line += 1) {
    const comment = comments[line];
    if (comment === 'comment') continue;
    if (line > commentStart) folds.push(commentFold(ctx, commentStart, line - 1));
    const prologue = comment === 'code' && isPrologueLine?.(line, lines[line] ?? '');
    if ((comment === 'code' || comment === 'excluded') && !prologue) break;
    while (comments[line + 1] === 'blank') line += 1;
    commentStart = line + 1;
  }
  return folds;
}

/** How an import line is read: it starts an import, is a directive (`'use client'`), a prologue, or ends the block. */
export type ImportLineClass = 'import' | 'directive' | 'prologue' | 'other';

export interface ImportRules {
  label: string;
  classify: (index: number, text: string) => ImportLineClass;
  findEnd: (lines: string[], start: number) => number;
  moduleOf: (statement: string) => string;
}

interface ImportScan {
  count: number;
  first: number | null;
  last: number;
  directives: number[];
  modules: string[];
}

/**
 * Port of FoldUtil.FoldImports: the block of imports at the top of the file. Directives directly
 * above the first import, with only blank lines between, fold in too and lead the summary.
 */
export function foldImports(ctx: FoldContext, rules: ImportRules): SideFold | null {
  const scan: ImportScan = { count: 0, first: null, last: 0, directives: [], modules: [] };
  for (let line = 0; line < ctx.lines.length; line += 1) {
    const next = importStep(ctx, rules, scan, line);
    if (next === null) break;
    line = next;
  }
  if (scan.first === null || scan.first === scan.last) return null;
  const first = scan.directives[0] ?? scan.first;
  return { first, last: scan.last, handle: first, kind: 'imports', tags: ['imports'], summary: importSummary(ctx.lines, rules, scan) };
}

// Returns the last line it consumed, or null at the line that ends the import block.
function importStep(ctx: FoldContext, rules: ImportRules, scan: ImportScan, line: number): number | null {
  const text = ctx.lines[line] ?? '';
  if (text.trim() === '') return line;
  if (ctx.comments[line] === 'comment') {
    if (scan.first === null) scan.directives = [];
    return line;
  }
  const kind = rules.classify(line, text);
  if (kind === 'import') return addImport(ctx.lines, rules, scan, line);
  if (scan.first !== null || kind === 'other') return null;
  scan.directives = kind === 'directive' ? [...scan.directives, line] : [];
  return line;
}

function addImport(lines: string[], rules: ImportRules, scan: ImportScan, line: number): number {
  const found = rules.findEnd(lines, line);
  const end = found < line || found >= lines.length ? line : found;
  scan.count += 1;
  scan.last = end;
  scan.modules.push(rules.moduleOf(lines.slice(line, end + 1).join('\n')));
  scan.first ??= line;
  return end;
}

function importSummary(lines: string[], rules: ImportRules, scan: ImportScan): SummarySegment[] {
  const directives = scan.directives.flatMap((line) => [trimmedSource(lines, line), SPACE]);
  const modules = scan.modules.flatMap((module, index) => [
    ...(index > 0 ? [styledText(', ', 'punctuation')] : []),
    styledText(module, 'module'),
  ]);
  return [
    ...directives,
    styledText(rules.label, 'keyword'),
    styledText(` ${scan.count} `, 'count'),
    styledText('(', 'punctuation'),
    ...modules,
    styledText(')', 'punctuation'),
  ];
}

function trimmedSource(lines: string[], line: number): SummarySegment {
  const text = lines[line] ?? '';
  return { kind: 'source', line, start: text.length - text.trimStart().length, end: text.trimEnd().length };
}

/** Port of FoldUtil.MergeFoldParses: where folds cover the same lines, the earlier list's fold wins. */
export function mergeFolds(...lists: SideFold[][]): SideFold[] {
  const byRange = new Map<string, SideFold>();
  for (const fold of lists.flat()) {
    const range = `${fold.first}:${fold.last}`;
    if (!byRange.has(range)) byRange.set(range, fold);
  }
  return [...byRange.values()];
}
