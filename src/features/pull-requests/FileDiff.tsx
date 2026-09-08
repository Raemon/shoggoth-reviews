'use client';

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CodeBlockEditor } from './CodeBlockEditor';
import { CommitEditModal } from './CommitEditModal';
import { DiffSide, type HunkControl } from './DiffSide';
import { useDiffLayout } from './diffLayoutStore';
import { withDraftThread, type DraftAnchor } from './draftThread';
import { startDraftThread, useDraftAnchor } from './draftThreadStore';
import { columnLines, resultLines, shownLines, unifiedLines, type DiffLine } from './diffLines';
import { langForPath } from './diffHighlight';
import { linesHeight, ROW_HEIGHT, SAVE_BAR, type RowHeights } from './diffMetrics';
import { useDiffWrap } from './diffWrapStore';
import { evenedRowHeights } from './rowHeights';
import { EditTarget } from './editTarget';
import { type EditableBlock } from './editableBlocks';
import { expandDiff } from './expandDiff';
import { foldsCollapsed, useFoldCommand, wholeFileFor, wholeFileWanted, type FoldMode } from './foldModeStore';
import { InlineThreads } from './InlineThreads';
import { useDiffWidth } from './commentColumnWidth';
import { FILE_DIFF_ATTR } from './litRow';
import { setDiffPaneWidth, useDiffPaneWidth } from './diffPaneWidth';
import { DragHandle, useDragWidth } from './ResizableColumn';
import { rowOf } from './commentAnchors';
import { useFileThreads } from './reviewThreadStore';
import { splitDiff, type DiffRow } from './splitDiff';
import { truncateFarRows, NO_TRUNCATION, type Truncation } from './truncateRows';
import { useCodeCollapse } from './useCodeCollapse';
import { useDefinitionPointer } from './useDefinitionPointer';
import { useDiffTokens, useIntralineEmphasis } from './useDiffSideHighlight';
import { useHeightTransition } from './useHeightTransition';
import { useHunkEdit, type HunkEdit, type HunkEditControls } from './useHunkEdit';
import { hunkHint, useWholeFile, type WholeFile } from './useWholeFile';
import type { ChangedFile, PullRequestSummary } from './pullRequests';
import { WHOLE_FILE_STATUS } from './wholeFileEntry';
import { useGithubToken } from '@/features/sources/sourceStore';
import { COMMIT_SHA_PATTERN } from '@/features/sources/sourceTypes';

export function FileDiff({
  owner,
  repo,
  file,
  baseRef,
  headRef,
}: {
  owner: string;
  repo: string;
  file: ChangedFile;
  baseRef: string;
  headRef: string;
}) {
  const token = useGithubToken();
  const target = useContext(EditTarget);
  const entireFile = file.status === WHOLE_FILE_STATUS;
  const layout = useDiffLayout();
  const singleColumn = layout !== 'split' || entireFile;
  const removedSize = { width: useDiffPaneWidth(useDiffWidth()), open: true };
  const startDrag = useDragWidth(removedSize, setDiffPaneWidth);
  const wrap = useDiffWrap();
  const measured = useMeasuredSides();
  const [wantWholeFile, setWantWholeFile] = useState(wholeFileWanted);
  const [threadOverflow, setThreadOverflow] = useState(0);
  const wholeFile = useWholeFile(owner, repo, file, baseRef, headRef, wantWholeFile);
  const patchRows = useMemo(() => splitDiff(file.patch ?? ''), [file.patch]);
  const rows = useMemo(() => rowsForDisplay(patchRows, wholeFile.lines, entireFile), [patchRows, wholeFile.lines, entireFile]);
  const showingWholeFile = rows !== patchRows;
  const emphasis = useIntralineEmphasis(rows);
  const tokens = useDiffTokens(rows, file.filename);
  const pull = target?.pull ?? null;
  const hunkEdit = useHunkEdit({
    owner,
    repo,
    pull,
    headRef: target?.headRef ?? '',
    rows,
    filename: file.filename,
    token,
    onCommitted: target?.onCommitted,
  });
  useFoldCommandWholeFile(hunkEdit, setWantWholeFile);
  const editBlock = hunkEdit.edit?.block ?? null;
  const fileThreads = useFileThreads(file.filename);
  const draftAnchor = useDraftAnchor();
  const threads = useMemo(
    () => withDraftThread(fileThreads, draftAnchor, { owner, repo, number: pull?.number ?? null, path: file.filename }),
    [fileThreads, draftAnchor, owner, repo, pull, file.filename],
  );
  const collapse = useCodeCollapse(rows, showingWholeFile, file.filename, threads, editBlock);
  const commentedRows = useMemo(() => new Set(threads.map((thread) => rowOf(thread, rows))), [threads, rows]);
  const alwaysDrawn = useMemo(() => rowsAlwaysDrawn(commentedRows, editBlock), [commentedRows, editBlock]);
  const [truncation, untruncate] = useRowTruncation(rows, collapse.hidden, alwaysDrawn, showingWholeFile);
  const undrawn = useMemo(() => undrawnRows(collapse.hidden, truncation), [collapse.hidden, truncation]);
  const rowHeights = singleColumn ? measured.right : evenedRowHeights(measured.left, measured.right);
  const resultView = layout === 'result' && !entireFile && anyLineSurvives(rows);
  const drawn = { hidden: collapse.hidden, commentedRows, truncation };
  const mainLines = useShownLines(rows, mainColumn(singleColumn, resultView), drawn);
  const leftLines = useShownLines(rows, singleColumn ? null : 'left', drawn);
  const growing = useHeightTransition(rows, undrawn, rowHeights);
  const expand = expandControl(wholeFile, showingWholeFile, hunkEdit, setWantWholeFile);
  const pointer = useDefinitionPointer(file, baseRef, headRef);
  const draftable = useMemo(() => (showingWholeFile ? patchLineKeys(patchRows) : null), [showingWholeFile, patchRows]);
  const draftThreadAt = draftThreadStarter(draftBase(owner, repo, pull, headRef, file.filename, token), draftable);
  const shared = {
    rows,
    tokens,
    emphasis,
    expand,
    anchors: collapse.anchors,
    pointer,
    wrap,
    heights: rowHeights,
    onUntruncate: untruncate,
    draftThreadAt,
  };
  const bounds = { hidden: undrawn, stopAtBlankLines: showingWholeFile };
  const editing = {
    editable: pull !== null,
    onEditBlock: (rowIndex: number) => hunkEdit.begin(rowIndex, bounds),
    editedRows: editBlock,
    editor: hunkEditor(file.filename, hunkEdit, mainLines, rowHeights),
  };
  return (
    <div ref={growing} {...{ [FILE_DIFF_ATTR]: '' }} className="flex" style={{ paddingBottom: threadOverflow }}>
      <div className="min-w-0 flex-1">
        {singleColumn ? (
          <DiffSide {...shared} lines={mainLines} labels onMeasured={measured.onRight} {...editing} />
        ) : (
          <div className="flex">
            <section className="relative flex shrink-0 flex-col border-r border-panel-edge" style={{ width: removedSize.width }}>
              <DiffSide
                {...shared}
                lines={leftLines}
                labels
                onMeasured={measured.onLeft}
                spacer={spacerFor(hunkEdit.edit, mainLines, rowHeights)}
              />
              <DragHandle onPointerDown={startDrag} />
            </section>
            <section className="flex min-w-0 flex-1 flex-col">
              <DiffSide {...shared} lines={mainLines} labels={false} onMeasured={measured.onRight} {...editing} />
            </section>
          </div>
        )}
      </div>
      <InlineThreads
        threads={threads}
        rows={rows}
        lines={mainLines}
        heights={rowHeights}
        foldAnchors={collapse.anchors}
        onOverflow={setThreadOverflow}
      />
      {hunkEdit.message !== null && hunkEdit.edit !== null && (
        <CommitEditModal
          path={file.filename}
          message={hunkEdit.message}
          committing={hunkEdit.committing}
          error={hunkEdit.failure}
          onMessage={hunkEdit.setMessage}
          onCommit={hunkEdit.commit}
          onRevert={hunkEdit.close}
          onCancel={hunkEdit.dismissModal}
        />
      )}
    </div>
  );
}

type DraftBase = Omit<DraftAnchor, 'line' | 'side'>;

function draftBase(
  owner: string,
  repo: string,
  pull: PullRequestSummary | null,
  commitId: string,
  path: string,
  token: string | null,
): DraftBase | null {
  if (pull === null || token === null || !COMMIT_SHA_PATTERN.test(commitId)) return null;
  return { owner, repo, number: pull.number, commitId, path };
}

function draftThreadStarter(base: DraftBase | null, draftable: Set<string> | null) {
  if (base === null) return undefined;
  return (line: number, side: 'left' | 'right') =>
    draftable && !draftable.has(lineKey(side, line)) ? null : () => startDraftThread({ ...base, line, side });
}

// GitHub rejects a comment on a line outside the diff, so expanded rows offer no button.
function patchLineKeys(rows: DiffRow[]): Set<string> {
  return new Set(rows.filter((row) => row.kind !== 'hunk').flatMap(rowLineKeys));
}

function rowLineKeys(row: DiffRow): string[] {
  const keys: string[] = [];
  if (row.left) keys.push(lineKey('left', row.left.line));
  if (row.right) keys.push(lineKey('right', row.right.line));
  return keys;
}

function lineKey(side: 'left' | 'right', line: number): string {
  return `${side}:${line}`;
}

interface MeasuredSides {
  left: RowHeights;
  right: RowHeights;
  onLeft: (heights: RowHeights) => void;
  onRight: (heights: RowHeights) => void;
}

// A single-column layout reports as the right side, the one every layout draws.
function useMeasuredSides(): MeasuredSides {
  const [left, onLeft] = useState<RowHeights>(null);
  const [right, onRight] = useState<RowHeights>(null);
  return { left, right, onLeft, onRight };
}

function useFoldCommandWholeFile(hunkEdit: HunkEditControls, setWantWholeFile: (next: boolean) => void) {
  const command = useFoldCommand();
  const applied = useRef(command.epoch);
  const apply = useRef<(mode: FoldMode) => void>(() => {});
  apply.current = (mode) => {
    const want = wholeFileFor(mode);
    if (want !== null && leaveEdit(hunkEdit)) setWantWholeFile(want);
  };
  useEffect(() => {
    if (applied.current === command.epoch) return;
    applied.current = command.epoch;
    apply.current(command.mode);
  }, [command]);
}

function rowsForDisplay(patchRows: DiffRow[], lines: WholeFile['lines'], entireFile: boolean): DiffRow[] {
  if (lines) return expandDiff(patchRows, lines.base, lines.head);
  return entireFile ? patchRows.filter((row) => row.kind !== 'hunk') : patchRows;
}

// A wholly deleted file has no surviving lines, so its result view falls back to the diff.
function anyLineSurvives(rows: DiffRow[]): boolean {
  return rows.some((row) => row.right !== null);
}

type Column = 'left' | 'right' | 'unified' | 'result';

interface DrawnRows {
  hidden: Set<number>;
  commentedRows: Set<number>;
  truncation: Truncation;
}

function mainColumn(singleColumn: boolean, resultView: boolean): Column {
  if (!singleColumn) return 'right';
  return resultView ? 'result' : 'unified';
}

// A null column is one this layout never draws, so its lines are never laid out.
function useShownLines(rows: DiffRow[], column: Column | null, drawn: DrawnRows): DiffLine[] {
  const { hidden, commentedRows, truncation } = drawn;
  return useMemo(
    () => (column ? shownLines(columnOf(rows, column, commentedRows), hidden, truncation) : []),
    [rows, column, commentedRows, hidden, truncation],
  );
}

function columnOf(rows: DiffRow[], column: Column, commentedRows: Set<number>): DiffLine[] {
  if (column === 'unified') return unifiedLines(rows);
  if (column === 'result') return resultLines(rows, commentedRows);
  return columnLines(rows, column);
}

const NO_RUNS: ReadonlySet<number> = new Set<number>();

type Untruncate = (run: number) => void;

// The memoized truncation is returned as-is: a fresh object here would re-lay-out every line each render.
function useRowTruncation(rows: DiffRow[], folded: Set<number>, anchored: Set<number>, wholeFile: boolean): [Truncation, Untruncate] {
  const [expanded, untruncate] = useExpandedRuns(rows, folded);
  const mode = useFoldCommand().mode;
  const truncating = wholeFile && foldsCollapsed(mode);
  const cut = useMemo(
    () => (truncating ? truncateFarRows({ rows, folded, anchored, expanded }) : NO_TRUNCATION),
    [truncating, rows, folded, anchored, expanded],
  );
  return [cut, untruncate];
}

interface HeldRuns {
  rows: DiffRow[];
  folded: Set<number>;
  runs: ReadonlySet<number>;
}

// A run is named by its first row, and refolding moves that row, so held names only fit the fold they came from.
function useExpandedRuns(rows: DiffRow[], folded: Set<number>): [ReadonlySet<number>, Untruncate] {
  const [held, setHeld] = useState<HeldRuns>({ rows, folded, runs: NO_RUNS });
  const untruncate = useCallback(
    (run: number) => setHeld((was) => ({ rows, folded, runs: new Set(runsAt(was, rows, folded)).add(run) })),
    [rows, folded],
  );
  return [runsAt(held, rows, folded), untruncate];
}

function runsAt(held: HeldRuns, rows: DiffRow[], folded: Set<number>): ReadonlySet<number> {
  return held.rows === rows && held.folded === folded ? held.runs : NO_RUNS;
}

// The open editor's rows have to keep drawing: cut, the editor would detach from the code it edits.
function rowsAlwaysDrawn(commentedRows: Set<number>, edit: EditableBlock | null): Set<number> {
  if (!edit) return commentedRows;
  const drawn = new Set(commentedRows);
  for (let row = edit.firstRow; row <= edit.lastRow; row += 1) drawn.add(row);
  return drawn;
}

function undrawnRows(hidden: Set<number>, cut: Truncation): Set<number> {
  if (cut.runOf.size === 0) return hidden;
  const undrawn = new Set(hidden);
  for (const row of cut.runOf.keys()) undrawn.add(row);
  return undrawn;
}

function expandControl(
  wholeFile: WholeFile,
  showingWholeFile: boolean,
  hunkEdit: HunkEditControls,
  setWantWholeFile: (update: (was: boolean) => boolean) => void,
): HunkControl {
  return {
    expanded: showingWholeFile,
    hint: hunkHint(wholeFile, showingWholeFile),
    onToggle: wholeFile.available ? () => toggleWholeFile(hunkEdit, setWantWholeFile) : null,
  };
}

function toggleWholeFile(hunkEdit: HunkEditControls, setWantWholeFile: (update: (was: boolean) => boolean) => void) {
  if (leaveEdit(hunkEdit)) setWantWholeFile((was) => !was);
}

function leaveEdit(hunkEdit: HunkEditControls): boolean {
  if (hunkEdit.edit && hunkEdit.edit.draft !== hunkEdit.edit.block.text) return false;
  hunkEdit.close();
  return true;
}

function hunkEditor(filename: string, hunkEdit: HunkEditControls, shown: DiffLine[], heights: RowHeights) {
  const edit = hunkEdit.edit;
  if (!edit) return null;
  return (
    <CodeBlockEditor
      key={edit.block.firstRow}
      value={edit.draft}
      lang={langForPath(filename)}
      caretLine={edit.block.caretLine}
      minHeight={coveredHeight(shown, edit.block, heights)}
      saving={hunkEdit.committing}
      onChange={hunkEdit.setDraft}
      onSave={hunkEdit.askToCommit}
      onExit={hunkEdit.askToCommit}
    />
  );
}

// Rendered lines, not rows: a unified change row draws its before and after line.
function coveredHeight(shown: DiffLine[], block: EditableBlock, heights: RowHeights): number {
  return linesHeight(shown.filter((line) => line.row >= block.firstRow && line.row <= block.lastRow), heights);
}

function spacerFor(edit: HunkEdit | null, shown: DiffLine[], heights: RowHeights): { afterRow: number; height: number } | null {
  if (!edit) return null;
  const covered = coveredHeight(shown, edit.block, heights);
  const drawn = Math.max(covered, edit.draft.split('\n').length * ROW_HEIGHT + SAVE_BAR);
  return { afterRow: edit.block.lastRow, height: drawn - covered };
}
