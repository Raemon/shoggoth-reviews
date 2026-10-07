import type { SummarySegment } from './foldModel';

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
