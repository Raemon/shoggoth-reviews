import { collapseRegions, type CollapseRegion } from '../pull-requests/collapseRegions';
import type { DiffRow } from '../pull-requests/splitDiff';
import type { CodePreview } from './mapPreviewTypes';

const MAX_ROWS = 120;
const MAX_SCAN_LINES = 2000;
const MAX_LINE_CHARS = 180;

export function foldedCodePreview(path: string, text: string, lineCount?: number, truncated = false): CodePreview {
  const source = sourceLines(text, truncated);
  const lines = source.slice(0, MAX_SCAN_LINES);
  const regions = collapseRegions(diffRows(lines), true, path);
  const preview = foldLines(lines, regions);
  return { ...preview, lineCount: lineCount ?? source.length, truncated: truncated || source.length > MAX_SCAN_LINES || preview.truncated };
}

function sourceLines(text: string, truncated: boolean): string[] {
  if (!text) return [];
  const lines = text.split('\n');
  if ((truncated && lines.length > 1) || lines.at(-1) === '') lines.pop();
  return lines;
}

function diffRows(lines: string[]): DiffRow[] {
  return lines.map((text, index) => ({ kind: 'context', label: '', left: null, right: { text, line: index + 1 } }));
}

function foldLines(source: string[], regions: CollapseRegion[]): CodePreview {
  const starts = foldingStarts(source, regions);
  const lines: string[] = [];
  const lineNumbers: number[] = [];
  let at = 0;
  while (at < source.length && lines.length < MAX_ROWS) at = appendLine(source, starts, at, lines, lineNumbers);
  return { lines, lineNumbers, truncated: at < source.length };
}

function foldingStarts(source: string[], regions: CollapseRegion[]): Map<number, CollapseRegion> {
  const starts = new Map<number, CollapseRegion>();
  for (const region of regions) {
    if (keepsMembersVisible(source, region.start)) continue;
    if ((starts.get(region.start)?.end ?? -1) < region.end) starts.set(region.start, region);
  }
  return joinTouchingRegions(starts);
}

function joinTouchingRegions(starts: Map<number, CollapseRegion>): Map<number, CollapseRegion> {
  for (const [start, region] of starts) {
    let end = region.end;
    while (starts.has(end)) end = starts.get(end)!.end;
    if (end !== region.end) starts.set(start, { ...region, end });
  }
  return starts;
}

function keepsMembersVisible(source: string[], start: number): boolean {
  for (let at = start; at >= Math.max(0, start - 12); at--) {
    const line = source[at] ?? '';
    if (containerDeclaration(line)) return true;
    if ((at < start && /[{};]/.test(line)) || /\b(?:fn|function|def)\b|\)\s*(?::|\{|$)/.test(line)) return false;
  }
  return false;
}

function containerDeclaration(line: string): boolean {
  return /^\s*(?:(?:export|default|pub(?:\([^)]*\))?|public|protected|private|abstract|declare|static|partial|sealed)\s+)*(?:class|impl|namespace|mod|module)\b/.test(line);
}

function appendLine(source: string[], starts: Map<number, CollapseRegion>, at: number, lines: string[], numbers: number[]): number {
  const region = starts.get(at);
  const text = source[at]!.trimEnd();
  if (!text) return at + 1;
  lines.push(region ? foldedLine(text, source[region.end]!, region.end - at) : clippedLine(text));
  numbers.push(at + 1);
  return (region?.end ?? at) + 1;
}

function foldedLine(first: string, last: string, hidden: number): string {
  const close = /^[\s}\]);,]+$/.test(last) ? ` ${last.trim()}` : '';
  return `${clippedLine(first)} …${close}  [${hidden} lines]`;
}

function clippedLine(line: string): string {
  return line.length > MAX_LINE_CHARS ? `${line.slice(0, MAX_LINE_CHARS)}…` : line;
}
