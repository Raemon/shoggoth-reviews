import type { LineRule } from './foldDialects';
import { pushSpan, type Span } from './foldSpan';

interface TrackedRule {
  rule: LineRule;
  stack: number[];
}

export function lineRuleSpans(lines: string[], rules: LineRule[], covered: Set<number>): Span[] {
  if (rules.length === 0) return [];
  const spans: Span[] = [];
  const tracked: TrackedRule[] = rules.map((rule) => ({ rule, stack: [] }));
  lines.forEach((text, index) => {
    if (!covered.has(index)) tracked.forEach((held) => applyLineRule(held, text, index, spans));
  });
  return spans;
}

function applyLineRule(held: TrackedRule, text: string, row: number, spans: Span[]) {
  const { rule, stack } = held;
  if (rule.skip?.test(text)) return;
  if (rule.close.test(text)) {
    const open = stack.pop();
    if (open !== undefined) pushSpan(spans, open, row, rule.kind);
  }
  if (rule.open.test(text) && !rule.selfClosed?.test(text)) stack.push(row);
}

interface LevelScan {
  levels: { level: number; row: number }[];
  lastContent: number;
}

function newLevelScan(): LevelScan {
  return { levels: [], lastContent: -1 };
}

function closeLevelsFrom(scan: LevelScan, level: number, kind: string, spans: Span[]) {
  while (scan.levels.length > 0 && (scan.levels[scan.levels.length - 1]?.level ?? -1) >= level) {
    const open = scan.levels.pop();
    if (open) pushSpan(spans, open.row, scan.lastContent, kind);
  }
}

function openLevel(scan: LevelScan, level: number, row: number, kind: string, spans: Span[]) {
  closeLevelsFrom(scan, level, kind, spans);
  scan.levels.push({ level, row });
  scan.lastContent = row;
}

function closeAllLevels(scan: LevelScan, kind: string, spans: Span[]) {
  closeLevelsFrom(scan, Number.NEGATIVE_INFINITY, kind, spans);
  scan.lastContent = -1;
}

const INDENT_COMMENT = /^\s*(#|\/\/|--)/;

export function indentSpans(lines: string[], covered: Set<number>): Span[] {
  const spans: Span[] = [];
  const scan = newLevelScan();
  lines.forEach((text, index) => {
    if (!covered.has(index) && text.trim() !== '' && !INDENT_COMMENT.test(text)) {
      openLevel(scan, indentOf(text), index, 'block', spans);
    }
  });
  closeAllLevels(scan, 'block', spans);
  return spans;
}

function indentOf(text: string): number {
  const leading = text.match(/^[ \t]*/)?.[0] ?? '';
  return leading.replace(/\t/g, '        ').length;
}

interface MarkdownScan extends LevelScan {
  fenced: boolean;
}

export function markdownSpans(lines: string[]): Span[] {
  const spans: Span[] = [];
  const scan: MarkdownScan = { ...newLevelScan(), fenced: false };
  lines.forEach((text, index) => markdownLine(text, index, scan, spans));
  closeAllLevels(scan, 'section', spans);
  return spans;
}

function markdownLine(text: string, row: number, scan: MarkdownScan, spans: Span[]) {
  if (/^\s*(```|~~~)/.test(text)) {
    scan.fenced = !scan.fenced;
    scan.lastContent = row;
    return;
  }
  if (scan.fenced) {
    scan.lastContent = row;
    return;
  }
  const heading = /^(#{1,6})\s/.exec(text);
  if (heading) openLevel(scan, heading[1]?.length ?? 1, row, 'section', spans);
  else if (text.trim() !== '') scan.lastContent = row;
}
