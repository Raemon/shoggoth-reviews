import type { CodeSegment } from './codeSegments';

// Squashed to the top half with a copy below, to match half-height lines.
const STACKED_MARKS =
  'relative inline-block indent-0 origin-top scale-y-50 after:absolute after:left-0 after:top-full after:bg-inherit after:content-[attr(data-marks)]';

export function SegmentSpan({ segment, side }: { segment: CodeSegment; side: 'left' | 'right' }) {
  return (
    <span className={segmentClass(segment, side)} data-marks={segment.margin ? segment.content : undefined} style={segment.style}>
      {segment.content}
    </span>
  );
}

function segmentClass(segment: CodeSegment, side: 'left' | 'right'): string | undefined {
  const tone = segment.emphasized ? emphasisTone(side) : '';
  return segment.margin ? `${STACKED_MARKS} ${tone}` : tone || undefined;
}

function emphasisTone(side: 'left' | 'right'): string {
  return side === 'left' ? 'bg-del-emph' : 'bg-add-emph';
}
