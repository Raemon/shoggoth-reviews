'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { collapseRegions, type CollapseRegion } from './collapseRegions';
import { rowOf } from './commentAnchors';
import { isDraftThread } from './draftThread';
import type { EditableBlock } from './editableBlocks';
import { foldsCollapsed, useFoldCommand, type FoldMode } from './foldModeStore';
import { allLinesDeleted, innerRows } from './foldSpan';
import { commentRowIndexes } from './regionRoles';
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
): CodeCollapse {
  const heuristic = useMemo(() => collapseRegions(rows, contiguous, filename), [rows, contiguous, filename]);
  const parsed = useTreeRegions(rows, contiguous, filename);
  const regions = parsed ?? heuristic;
  const threadRows = useMemo(() => threadRowIndexes(threads, rows), [threads, rows]);
  const commentRows = useMemo(() => commentRowIndexes(rows, filename, regions), [rows, filename, regions]);
  const command = useFoldCommand();
  const [overrides, setOverride] = useFoldOverrides(command.epoch);
  const allDeleted = allLinesDeleted(rows);
  return useMemo(
    () => buildCollapse({ regions, threadRows, commentRows, edit, mode: command.mode, overrides, setOverride, allDeleted }),
    [regions, threadRows, commentRows, edit, command.mode, overrides, setOverride, allDeleted],
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
  threadRows: ThreadRows;
  commentRows: Set<number>;
  edit: EditableBlock | null;
  mode: FoldMode;
  overrides: Overrides;
  setOverride: SetOverride;
  allDeleted: boolean;
}

function buildCollapse(inputs: FoldInputs): CodeCollapse {
  const { regions, threadRows, edit, mode, overrides, setOverride, allDeleted } = inputs;
  const anchors = new Map<number, CollapseAnchor>();
  const hidden = new Set<number>();
  const foldable = regions.filter((region) => !regionOverlapsEdit(region, edit));
  for (const region of foldable) {
    const inner = innerRows(region);
    const hiddenThreads = countIn(inner, threadRows.posted);
    const collapsed = overrides[region.key] ?? modeCollapsed(region, foldable, countIn(inner, threadRows.any), mode, allDeleted);
    const toggle = () => setOverride(collapsed ? expansionFrom(foldable, region) : { [region.key]: true });
    anchors.set(region.start, { region, collapsed, hiddenThreads, toggle });
    if (collapsed) for (const row of inner) hidden.add(row);
  }
  if (mode === 'collapseHidingComments') hideCommentsAboveFolds(anchors, inputs, hidden);
  return { anchors, hidden };
}

function hideCommentsAboveFolds(anchors: Map<number, CollapseAnchor>, inputs: FoldInputs, hidden: Set<number>) {
  for (const anchor of anchors.values()) {
    if (!anchor.collapsed) continue;
    for (let row = anchor.region.start - 1; hideableComment(row, anchors, inputs); row -= 1) hidden.add(row);
  }
}

function hideableComment(row: number, anchors: Map<number, CollapseAnchor>, { commentRows, threadRows }: FoldInputs): boolean {
  if (!commentRows.has(row) || threadRows.any.has(row)) return false;
  return anchors.get(row)?.collapsed !== false;
}

function expansionFrom(foldable: CollapseRegion[], region: CollapseRegion): Overrides {
  const nested = foldable.filter((other) => other.start >= region.start && other.end <= region.end);
  return Object.fromEntries(nested.map((other) => [other.key, false]));
}

// start < lastRow: the anchor row only bounds the block, and must keep its chevron.
function regionOverlapsEdit(region: CollapseRegion, edit: EditableBlock | null): boolean {
  return edit !== null && region.start < edit.lastRow && region.end >= edit.firstRow;
}

function modeCollapsed(region: CollapseRegion, foldable: CollapseRegion[], hiddenThreads: number, mode: FoldMode, allDeleted: boolean): boolean {
  if (!foldsCollapsed(mode)) return false;
  if (mode === 'collapseExceptTypes') return !region.typeLike && !withinTypeRegion(foldable, region);
  if (mode === 'collapseExceptComments') return !region.comment;
  if (mode === 'collapseHidingComments') return true;
  return hiddenThreads === 0 && (allDeleted || region.imports || unchangedRegion(region));
}

function withinTypeRegion(foldable: CollapseRegion[], region: CollapseRegion): boolean {
  return foldable.some((other) => other !== region && other.typeLike && other.start <= region.start && other.end >= region.end);
}

function unchangedRegion(region: CollapseRegion): boolean {
  return region.addedLines === 0 && region.deletedLines === 0 && !region.anchorChanged;
}
