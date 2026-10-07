'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { rowOf } from './commentAnchors';
import { allLinesDeleted, computeDiffFolds, type DiffFold } from './diffFolds';
import { isDraftThread } from './draftThread';
import type { EditableBlock } from './editableBlocks';
import { foldsCollapsed, useFoldCommand, type FoldMode } from './foldModeStore';
import type { Side } from './foldModel';
import type { ReviewThread } from './reviewThreads';
import type { DiffRow } from './splitDiff';

export interface FoldControl {
  fold: DiffFold;
  collapsed: boolean;
  hiddenThreads: number;
  toggle: () => void;
}

export interface CodeCollapse {
  /** Keyed by `handleKey`, for the chevron on an open fold's handle line. */
  handles: Map<string, FoldControl>;
  /** Every row inside a collapsed fold, mapped to the outermost collapsed fold over it. */
  folded: Map<number, FoldControl>;
  hidden: Set<number>;
  /** Hidden rows below each collapsed fold's first, the row its summary is drawn at. */
  tucked: Set<number>;
}

type Overrides = Record<string, boolean>;
type SetOverride = (changes: Overrides) => void;

const NO_OVERRIDES: Overrides = {};
const NO_FOLDS: DiffFold[] = [];

export function handleKey(side: Side, row: number): string {
  return `${side}:${row}`;
}

/** Folds need both sides' whole files, so `complete` is false while only the patch is loaded. */
export function useCodeCollapse(
  rows: DiffRow[],
  complete: boolean,
  filename: string,
  threads: ReviewThread[],
  edit: EditableBlock | null,
): CodeCollapse {
  const folds = useDiffFolds(rows, complete, filename);
  const threadRows = useMemo(() => threadRowIndexes(threads, rows), [threads, rows]);
  const command = useFoldCommand();
  const [overrides, setOverride] = useFoldOverrides(command.epoch);
  const allDeleted = allLinesDeleted(rows);
  return useMemo(
    () => buildCollapse({ folds, threadRows, edit, mode: command.mode, overrides, setOverride, allDeleted }),
    [folds, threadRows, edit, command.mode, overrides, setOverride, allDeleted],
  );
}

function useDiffFolds(rows: DiffRow[], complete: boolean, filename: string): DiffFold[] {
  const found = useMemo(() => (complete ? computeDiffFolds(rows, filename) : NO_FOLDS), [rows, complete, filename]);
  return useSettled(found) ?? NO_FOLDS;
}

function useSettled<T>(value: T | Promise<T>): T | null {
  const [held, setHeld] = useState<{ from: Promise<T>; value: T } | null>(null);
  useEffect(() => {
    if (!(value instanceof Promise)) return;
    let live = true;
    value
      .then((settled) => {
        if (live) setHeld({ from: value, value: settled });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [value]);
  if (!(value instanceof Promise)) return value;
  return held?.from === value ? held.value : null;
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

function countWithin(rows: Set<number>, fold: DiffFold): number {
  let count = 0;
  for (const row of rows) if (row >= fold.first && row <= fold.last) count += 1;
  return count;
}

interface FoldInputs {
  folds: DiffFold[];
  threadRows: ThreadRows;
  edit: EditableBlock | null;
  mode: FoldMode;
  overrides: Overrides;
  setOverride: SetOverride;
  allDeleted: boolean;
}

function buildCollapse(inputs: FoldInputs): CodeCollapse {
  const foldable = inputs.folds.filter((fold) => !foldOverlapsEdit(fold, inputs.edit));
  const controls = foldable.map((fold) => foldControl(fold, foldable, inputs));
  const handles = new Map(controls.map((control) => [handleKey(control.fold.side, control.fold.handle), control]));
  return { handles, ...foldedRows(controls) };
}

function foldControl(fold: DiffFold, foldable: DiffFold[], inputs: FoldInputs): FoldControl {
  const { threadRows, mode, overrides, setOverride, allDeleted } = inputs;
  const hiddenThreads = countWithin(threadRows.posted, fold);
  const collapsed = overrides[fold.key] ?? modeCollapsed(fold, foldable, countWithin(threadRows.any, fold), mode, allDeleted);
  const toggle = () => setOverride(collapsed ? expansionFrom(foldable, fold) : { [fold.key]: true });
  return { fold, collapsed, hiddenThreads, toggle };
}

// Outermost first: a fold inside a collapsed one is already out of sight.
function foldedRows(controls: FoldControl[]): Pick<CodeCollapse, 'folded' | 'hidden' | 'tucked'> {
  const folded = new Map<number, FoldControl>();
  const tucked = new Set<number>();
  const collapsed = controls.filter((control) => control.collapsed).sort((a, b) => a.fold.first - b.fold.first || b.fold.last - a.fold.last);
  for (const control of collapsed) {
    const { first, last } = control.fold;
    if (folded.has(first)) continue;
    for (let row = first; row <= last; row += 1) folded.set(row, control);
    for (let row = first + 1; row <= last; row += 1) tucked.add(row);
  }
  return { folded, hidden: new Set(folded.keys()), tucked };
}

function expansionFrom(foldable: DiffFold[], fold: DiffFold): Overrides {
  const nested = foldable.filter((other) => other.first >= fold.first && other.last <= fold.last);
  return Object.fromEntries(nested.map((other) => [other.key, false]));
}

function foldOverlapsEdit(fold: DiffFold, edit: EditableBlock | null): boolean {
  return edit !== null && fold.first <= edit.lastRow && fold.last >= edit.firstRow;
}

function modeCollapsed(fold: DiffFold, foldable: DiffFold[], threads: number, mode: FoldMode, allDeleted: boolean): boolean {
  if (!foldsCollapsed(mode)) return false;
  if (mode === 'collapseExceptTypes') return !fold.tags.includes('type') && !withinTypeFold(foldable, fold);
  if (mode === 'collapseAll') return true;
  return threads === 0 && (allDeleted || (linked(fold) && (fold.tags.includes('imports') || unchanged(fold))));
}

function withinTypeFold(foldable: DiffFold[], fold: DiffFold): boolean {
  return foldable.some((other) => other !== fold && other.tags.includes('type') && other.first <= fold.first && other.last >= fold.last);
}

function linked(fold: DiffFold): boolean {
  return fold.left !== null && fold.right !== null;
}

function unchanged(fold: DiffFold): boolean {
  return fold.addedLines === 0 && fold.deletedLines === 0;
}
