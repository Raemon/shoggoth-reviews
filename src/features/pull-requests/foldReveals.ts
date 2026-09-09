import type { CollapseRegion } from './collapseRegions';
import type { FoldCommand } from './foldModeStore';
import type { DiffRow } from './splitDiff';

export interface FoldReveal {
  blocks: ReadonlySet<CollapseRegion>;
  ancestors: ReadonlySet<CollapseRegion>;
}

export const NO_REVEAL: FoldReveal = { blocks: new Set(), ancestors: new Set() };

// A match opens everything nested inside it; its ancestors open too, so it can be seen.
export function revealedRegions(regions: CollapseRegion[], rows: DiffRow[], command: FoldCommand): FoldReveal {
  const hits = searchHits(rows, command.search);
  const matches = regions.filter((region) => revealsItself(region, command, hits));
  if (matches.length === 0) return NO_REVEAL;
  const blocks = new Set(regions.filter((region) => enclosedByAny(matches, region)));
  const ancestors = new Set(regions.filter((region) => !blocks.has(region) && enclosesAny(matches, region)));
  return { blocks, ancestors };
}

function revealsItself(region: CollapseRegion, { reveals }: FoldCommand, hits: (region: CollapseRegion) => boolean): boolean {
  if (reveals.has('comments') && region.comment) return true;
  if (reveals.has('types') && region.typeLike) return true;
  if (reveals.has('functions') && region.functionLike) return true;
  return hits(region);
}

// Start-ordered inputs let the scan stop at the first candidate past the inner start.
function enclosedByAny(outers: CollapseRegion[], inner: CollapseRegion): boolean {
  for (const outer of outers) {
    if (outer.start > inner.start) return false;
    if (outer.end >= inner.end) return true;
  }
  return false;
}

function enclosesAny(inners: CollapseRegion[], outer: CollapseRegion): boolean {
  for (const inner of inners) {
    if (inner.start > outer.end) return false;
    if (inner.start >= outer.start && inner.end <= outer.end) return true;
  }
  return false;
}

function searchHits(rows: DiffRow[], search: string): (region: CollapseRegion) => boolean {
  if (search === '') return () => false;
  const matchesBefore = matchCounts(rows, search.toLowerCase());
  return (region) => (matchesBefore[region.end + 1] ?? 0) - (matchesBefore[region.start] ?? 0) > 0;
}

function matchCounts(rows: DiffRow[], wanted: string): number[] {
  const counts = [0];
  let seen = 0;
  for (const row of rows) counts.push((seen += Number(rowText(row).includes(wanted))));
  return counts;
}

function rowText(row: DiffRow): string {
  return `${row.left?.text ?? ''}\n${row.right?.text ?? ''}`.toLowerCase();
}
