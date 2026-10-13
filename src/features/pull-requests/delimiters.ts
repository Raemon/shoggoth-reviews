import { CODE, type ScannedText } from './partialTokenizer';

export interface DelimiterPair {
  open: number;
  close: number;
  openLine: number;
  closeLine: number;
}

const OPENERS = '([{<';
const CLOSERS = ')]}>';
const CLOSER_OF: Record<string, string> = { '(': ')', '[': ']', '{': '}', '<': '>' };

/**
 * Port of Vanadium's DelimMatcher.MatchDelimiters, sorted by opening offset. `<` and `>` pair up
 * when they can; a stray `>` is a greater-than, and stray `<`s give way to the next real closer.
 */
export function matchDelimiters(scan: ScannedText): DelimiterPair[] {
  const { text, classes } = scan;
  const offsets: [number, number][] = [];
  const pending: number[] = [];
  for (let at = 0; at < text.length; at += 1) {
    if (classes[at] !== CODE) continue;
    const char = text[at] ?? '';
    if (OPENERS.includes(char)) pending.push(at);
    else if (CLOSERS.includes(char)) closeDelimiter(text, at, pending, offsets);
  }
  offsets.sort((a, b) => a[0] - b[0]);
  return offsets.map(([open, close]) => ({ open, close, openLine: lineAt(scan, open), closeLine: lineAt(scan, close) }));
}

function closeDelimiter(text: string, at: number, pending: number[], offsets: [number, number][]) {
  const top = pending[pending.length - 1];
  if (top === undefined) return;
  if (CLOSER_OF[text[top] ?? ''] === text[at]) {
    offsets.push([top, at]);
    pending.pop();
    return;
  }
  if (text[at] === '>') return;
  while (pending.length > 0 && text[pending[pending.length - 1] ?? 0] === '<') pending.pop();
  const open = pending.pop();
  if (open !== undefined) offsets.push([open, at]);
}

function lineAt(scan: ScannedText, offset: number): number {
  const { lineStarts } = scan;
  let low = 0;
  let high = lineStarts.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if ((lineStarts[middle] ?? 0) <= offset) low = middle;
    else high = middle - 1;
  }
  return low;
}

/** Port of DelimMatcher.GetDelimiterParents: each pair's nearest enclosing pair, by index. */
export function delimiterParents(pairs: DelimiterPair[]): (number | null)[] {
  const parents: (number | null)[] = [];
  pairs.forEach((pair, index) => {
    let at: number | null = index > 0 ? index - 1 : null;
    while (at !== null && !contains(pairs[at], pair)) at = parents[at] ?? null;
    parents.push(at);
  });
  return parents;
}

function contains(outer: DelimiterPair | undefined, inner: DelimiterPair): boolean {
  return outer !== undefined && inner.open >= outer.open && inner.close <= outer.close;
}
