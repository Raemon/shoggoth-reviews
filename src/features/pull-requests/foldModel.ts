import type { ReactNode } from 'react';

export type Side = 'left' | 'right';

/** A slice of one line of the fold's own file, drawn with that text's syntax highlighting. */
export interface SourceSegment {
  kind: 'source';
  line: number;
  start: number;
  end: number;
}

/** Drawn as given; `text` stands in for it when summaries are compared. */
export interface NodeSegment {
  kind: 'node';
  node: ReactNode;
  text: string;
}

export type SummarySegment = SourceSegment | NodeSegment;

export type FoldTag = 'imports' | 'comment' | 'type';

/** A fold in one side's complete file. Lines are 0-based indexes, and `last` is inclusive. */
export interface SideFold {
  first: number;
  last: number;
  /** Where the chevron sits while the fold is open; a header comment above it is still inside the fold. */
  handle: number;
  kind: string;
  tags: FoldTag[];
  summary: SummarySegment[];
}

export interface FoldSource {
  filename: string;
  lines: string[];
}

export interface FoldMethod {
  id: string;
  folds: (source: FoldSource) => SideFold[] | Promise<SideFold[]>;
}
