/** A raw fold candidate from a fold method, by 0-based line index. */
export interface Span {
  start: number;
  end: number;
  kind: string;
  imports: boolean;
}

export function pushSpan(spans: Span[], start: number, end: number, kind: string) {
  if (end > start) spans.push({ start, end, kind, imports: false });
}

export function addRange(covered: Set<number>, start: number, end: number) {
  for (let line = start; line <= end; line += 1) covered.add(line);
}
