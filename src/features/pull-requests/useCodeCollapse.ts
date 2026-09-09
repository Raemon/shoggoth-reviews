'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { collapseRegions, type CollapseRegion } from './collapseRegions';
import { rowOf } from './commentAnchors';
import { isDraftThread } from './draftThread';
import type { EditableBlock } from './editableBlocks';
import { useFoldCommand, type FoldCommand } from './foldModeStore';
import { revealedRegions, type FoldReveal } from './foldReveals';
import { allLinesDeleted, innerRows } from './foldSpan';
import type { ReviewThread } from './reviewThreads';
import type { DiffRow } from './splitDiff';
import { treeCollapseRegions } from './treeSitterFolds';

export interface CollapseAnchor {
  region: CollapseRegion;
  collapsed: boolean;
  hiddenThreads: number;
  toggle: () => void;
}

export interface CodeCollapse {
  anchors: Map<number, CollapseAnchor>;
  hidden: Set<number>;
}

type Overrides = Record<string, boolean>;
type SetOverride = (changes: Overrides) => void;

const NO_OVERRIDES: Overrides = {};

export function useCodeCollapse(
  rows: DiffRow[],
  contiguous: boolean,
  filename: string,
  threads: ReviewThread[],
  edit: EditableBlock | null,
  revealedOnly: boolean,
): CodeCollapse {
  const heuristic = useMemo(() => collapseRegions(rows, contiguous, filename), [rows, contiguous, filename]);
  const parsed = useTreeRegions(rows, contiguous, filename);
  const regions = parsed ?? heuristic;
  const threadRows = useMemo(() => threadRowIndexes(threads, rows), [threads, rows]);
  const command = useFoldCommand();
  const reveal = useMemo(() => revealedRegions(regions, rows, command), [regions, rows, command]);
  const [overrides, setOverride] = useFoldOverrides(command.epoch);
  const allDeleted = allLinesDeleted(rows);
  return useMemo(
    () => buildCollapse({ regions, rowCount: rows.length, threadRows, edit, mode: command.mode, reveal, revealedOnly, overrides, setOverride, allDeleted }),
    [regions, rows.length, threadRows, edit, command.mode, reveal, revealedOnly, overrides, setOverride, allDeleted],
  );
}

interface HeldOverrides {
  epoch: number;
  overrides: Overrides;
}

function overridesAt(held: HeldOverrides, epoch: number): Overrides {
  return held.epoch === epoch ? held.overrides : NO_OVERRIDES;
}

function useFoldOverrides(epoch: number): [Overrides, SetOverride] {
  const [held, setHeld] = useState<HeldOverrides>({ epoch, overrides: NO_OVERRIDES });
  const setOverride = useCallback<SetOverride>(
    (changes) => setHeld((was) => ({ epoch, overrides: { ...overridesAt(was, epoch), ...changes } })),
    [epoch],
  );
  return [overridesAt(held, epoch), setOverride];
}

interface TreeRegionsHeld {
  rows: DiffRow[];
  contiguous: boolean;
  filename: string;
  regions: CollapseRegion[];
}

function useTreeRegions(rows: DiffRow[], contiguous: boolean, filename: string): CollapseRegion[] | null {
  const [held, setHeld] = useState<TreeRegionsHeld | null>(null);
  useEffect(() => {
    let cancelled = false;
    treeCollapseRegions(rows, contiguous, filename)
      .then((regions) => {
        if (!cancelled && regions) setHeld({ rows, contiguous, filename, regions });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [rows, contiguous, filename]);
  if (!held || held.rows !== rows || held.contiguous !== contiguous || held.filename !== filename) return null;
  return held.regions;
}

interface ThreadRows {
  posted: Set<number>;
  any: Set<number>;
}

function threadRowIndexes(threads: ReviewThread[], rows: DiffRow[]): ThreadRows {
  const posted = threads.filter((thread) => !isDraftThread(thread));
  return { posted: rowIndexes(posted, rows), any: rowIndexes(threads, rows) };
}

function rowIndexes(threads: ReviewThread[], rows: DiffRow[]): Set<number> {
  const found = new Set<number>();
  for (const thread of threads) {
    const index = rowOf(thread, rows);
    if (index >= 0) found.add(index);
  }
  return found;
}

function countIn(rows: number[], within: Set<number>): number {
  return rows.filter((row) => within.has(row)).length;
}

interface FoldInputs {
  regions: CollapseRegion[];
  rowCount: number;
  threadRows: ThreadRows;
  edit: EditableBlock | null;
  mode: FoldCommand['mode'];
  reveal: FoldReveal;
  revealedOnly: boolean;
  overrides: Overrides;
  setOverride: SetOverride;
  allDeleted: boolean;
}

function buildCollapse(inputs: FoldInputs): CodeCollapse {
  const { regions, threadRows, edit, overrides, setOverride, reveal, revealedOnly } = inputs;
  const anchors = new Map<number, CollapseAnchor>();
  const hidden = revealedOnly ? complementOf(revealedRows(regions, reveal.blocks), inputs.rowCount) : new Set<number>();
  const foldable = regions.filter((region) => !regionOverlapsEdit(region, edit) && (!revealedOnly || reveal.blocks.has(region)));
  for (const region of foldable) {
    const inner = innerRows(region);
    const hiddenThreads = countIn(inner, threadRows.posted);
    const collapsed = overrides[region.key] ?? modeCollapsed(region, countIn(inner, threadRows.any), inputs);
    const toggle = () => setOverride(collapsed ? expansionFrom(foldable, region) : { [region.key]: true });
    anchors.set(region.start, { region, collapsed, hiddenThreads, toggle });
    if (collapsed) for (const row of inner) hidden.add(row);
  }
  return { anchors, hidden };
}

function revealedRows(regions: CollapseRegion[], revealed: ReadonlySet<CollapseRegion>): Set<number> {
  const rows = new Set<number>();
  for (const region of regions) {
    if (revealed.has(region)) for (let row = region.start; row <= region.end; row += 1) rows.add(row);
  }
  return rows;
}

function complementOf(rows: Set<number>, rowCount: number): Set<number> {
  const rest = new Set<number>();
  for (let row = 0; row < rowCount; row += 1) if (!rows.has(row)) rest.add(row);
  return rest;
}

function expansionFrom(foldable: CollapseRegion[], region: CollapseRegion): Overrides {
  const nested = foldable.filter((other) => startsWithin(other, region));
  return Object.fromEntries(nested.map((other) => [other.key, false]));
}

function startsWithin(other: CollapseRegion, region: CollapseRegion): boolean {
  return other.start >= region.start && other.start < region.end;
}

// start < lastRow: the anchor row only bounds the block, and must keep its chevron.
function regionOverlapsEdit(region: CollapseRegion, edit: EditableBlock | null): boolean {
  return edit !== null && region.start < edit.lastRow && region.end >= edit.firstRow;
}

function modeCollapsed(region: CollapseRegion, hiddenThreads: number, { mode, reveal, allDeleted }: FoldInputs): boolean {
  if (mode === 'expandAll' || reveal.blocks.has(region) || reveal.ancestors.has(region)) return false;
  if (mode !== 'default') return true;
  return hiddenThreads === 0 && (allDeleted || region.imports || unchangedRegion(region));
}

function unchangedRegion(region: CollapseRegion): boolean {
  return region.addedLines === 0 && region.deletedLines === 0 && !region.anchorChanged;
}
