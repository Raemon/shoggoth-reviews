'use client';

import { Fragment, useLayoutEffect, useRef, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { blockHasRow, hunkHasEditableLines, type EditableBlock } from './editableBlocks';
import { codeSegments, withMargins, type CodeSegment } from './codeSegments';
import { commentMargins } from './commentMargins';
import { collapsedPreview } from './collapsedPreview';
import { diffEditModeOn } from './editModeStore';
import type { DiffLine, FoldLine } from './diffLines';
import type { ThemedToken } from './diffHighlight';
import type { CharRange, IntralineRanges } from './intralineDiff';
import type { DiffRow } from './splitDiff';
import { summaryParts, type SummaryPart } from './summarySegments';
import { handleKey, type FoldControl } from './useCodeCollapse';
import type { CodePointer } from './useDefinitionPointer';
import type { SideTokens } from './useDiffSideHighlight';
import { COLLAPSED_ROW_GAP, collapsedRowGap, lineHeight, type RowHeights, type WrappedHeights } from './diffMetrics';
import { ROW_ATTR } from './litRow';
import { SegmentSpan } from './SegmentSpan';
import { SEMIBLANK_CODE } from './semiblankLines';
import { hangingIndent, measureRowHeights, sameRowHeights, WRAPPED_CELL } from './rowHeights';
import { HoverCardTrigger } from '@/features/surface-ui/HoverCard';
import { plural } from '@/features/surface-ui/plural';
import { SelectableRow } from '@/features/surface-ui/SelectableRow';

const ROW = 'flex h-[15px] items-center gap-1 leading-[15px]';
const WRAPPED_ROW = 'flex min-h-[15px] items-start gap-1 leading-[15px]';
const BLANK_ROW = 'flex items-center gap-1';
const SEMIBLANK_ROW = 'flex items-start gap-1 leading-[15px]';
const GUTTER = 'relative flex w-[52px] shrink-0 select-none items-center pr-1 text-[9px] text-ink-dim';
const FOLDING_GUTTER = 'cursor-pointer hover:text-ink';
const TONED_GUTTER = 'self-stretch group-hover:row-shade group-[.diff-line-lit]:row-lit';
const DRAFT_BTN =
  'absolute left-0 flex w-[11px] items-center justify-center rounded-sm bg-btn text-[10px] leading-none text-ink-dim opacity-0 hover:bg-btn-hover hover:text-ink focus-visible:opacity-100 group-hover:opacity-100';
const TOUCHED_MARK = 'bg-add-bg/60 shadow-[inset_2px_0_0_var(--add-emph)]';
const STICKY_CHIP = 'sticky right-0 shrink-0 rounded bg-procgen px-1 hover:bg-btn-hover hover:text-ink';
const EDIT_BTN = `${STICKY_CHIP} uppercase tracking-[0.14em]`;
const FOLD_BADGE = `${STICKY_CHIP} ml-auto text-[9px] italic text-ink-dim`;
const FOLD_PREVIEW = 'diff-code hidden max-w-[90ch] shrink-[999] overflow-hidden text-ellipsis whitespace-pre pl-2 text-[11px] text-ink-dim/70 group-hover:block';
const CODE = 'diff-code whitespace-pre pr-2 text-[11px]';
const CLIPPED_CODE = `${CODE} min-w-0 overflow-hidden text-ellipsis`;
// break-word, so only a word too long for a whole line is ever split.
const WRAPPED_CODE = `diff-code min-w-0 flex-1 whitespace-pre-wrap [overflow-wrap:break-word] [tab-size:8] pr-2 text-[11px]`;
// 100px keeps the fold badge clear of the ellipsis; 100cqw is the visible column width.
const FOLDED_TEXT = 'flex min-w-0 max-w-[calc(100cqw-100px)] overflow-hidden';
const STRIP = `${ROW} bg-procgen px-1 text-left text-[9px] text-ink-dim`;
const TRUNCATED_STRIP = `${STRIP} w-full italic hover:bg-btn-hover hover:text-ink`;

export interface HunkControl {
  expanded: boolean;
  hint: string;
  onToggle: (() => void) | null;
}

export interface SideProps {
  rows: DiffRow[];
  lines: DiffLine[];
  labels: boolean;
  tokens: SideTokens | null;
  emphasis: (IntralineRanges | null)[];
  expand: HunkControl;
  handles: Map<string, FoldControl>;
  editable?: boolean;
  onEditBlock?: (rowIndex: number) => void;
  editor?: ReactNode;
  editedRows?: EditableBlock | null;
  spacer?: { afterRow: number; height: number } | null;
  pointer?: CodePointer;
  wrap: boolean;
  stackMargins: boolean;
  heights: RowHeights;
  onMeasured: (heights: WrappedHeights) => void;
  onUntruncate?: (run: number) => void;
  draftThreadAt?: (line: number, side: 'left' | 'right') => (() => void) | null;
}

export function DiffSide(props: SideProps) {
  const pane = useRef<HTMLDivElement | null>(null);
  useMeasuredRows(pane, props.wrap, props.onMeasured);
  return (
    <div ref={pane} className="min-w-0 flex-1">
      <PaneLines {...props} />
    </div>
  );
}

function PaneLines(props: SideProps) {
  const { lines, editedRows, editor } = props;
  if (!editedRows) return <DiffLines {...props} from={0} to={lines.length} />;
  const edited = editedLineRange(lines, editedRows);
  return (
    <>
      <DiffLines {...props} from={0} to={edited.first} />
      {editor}
      <DiffLines {...props} from={edited.last + 1} to={lines.length} />
    </>
  );
}

/** No dep array: every render can rewrap, and a resize does so without one. */
function useMeasuredRows(pane: React.RefObject<HTMLElement | null>, wrapping: boolean, onMeasured: (heights: WrappedHeights) => void) {
  const held = useRef<WrappedHeights>(null);
  const report = (next: WrappedHeights) => {
    if (sameRowHeights(held.current, next)) return;
    held.current = next;
    onMeasured(next);
  };
  const latest = useRef(report);
  latest.current = report;
  useLayoutEffect(() => {
    const element = pane.current;
    if (!element || !wrapping) return latest.current(null);
    const measure = () => latest.current(measureRowHeights(element));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  });
}

function editedLineRange(lines: DiffLine[], block: EditableBlock): { first: number; last: number } {
  const covered = lines.flatMap((line, index) => (blockHasRow(block, line.row) ? [index] : []));
  return { first: covered[0] ?? lines.length, last: covered[covered.length - 1] ?? lines.length - 1 };
}

function DiffLines({
  rows,
  lines,
  from,
  to,
  labels,
  tokens,
  emphasis,
  expand,
  handles,
  editable,
  onEditBlock,
  spacer,
  pointer,
  wrap,
  stackMargins,
  heights,
  onUntruncate,
  draftThreadAt,
}: SideProps & { from: number; to: number }) {
  if (from >= to) return null;
  const spacerLine = spacer ? lastLineOfRow(lines, spacer.afterRow) : -1;
  const drawn = drawnLineKeys(lines);
  return (
    <div className={`@container min-w-0 flex-1 ${wrap ? '' : 'overflow-x-auto'}`}>
      <div className={wrap ? 'w-full' : 'w-max min-w-full'}>
        {lines.slice(from, to).map((line, offset) => {
          const index = from + offset;
          const gap = collapsedRowGap(line, lines[index + 1]);
          return (
            <Fragment key={index}>
              {line.fold ? (
                <FoldSummaryRow fold={line.fold} side={line.side} rows={rows} tokens={tokens} />
              ) : (
                <DiffLineView
                  line={line}
                  labels={labels}
                  lineTokens={tokens?.[line.side][line.row] ?? null}
                  ranges={rangesFor(emphasis[line.row], line.side)}
                  expand={expand}
                  handle={handleOf(line, handles, drawn)}
                  wrap={wrap}
                  stackMargins={stackMargins}
                  height={lineHeight(line, heights)}
                  editable={editable}
                  onEdit={editStarter(rows, line.row, onEditBlock)}
                  pointer={pointer}
                  onUntruncate={onUntruncate}
                  onDraft={draftStarter(rows, line, draftThreadAt)}
                />
              )}
              {gap > 0 && <div style={{ height: COLLAPSED_ROW_GAP }} aria-hidden />}
              {spacerLine === index && <div style={{ height: spacer?.height }} />}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function lastLineOfRow(lines: DiffLine[], row: number): number {
  for (let index = lines.length - 1; index >= 0; index -= 1) if (lines[index]?.row === row) return index;
  return -1;
}

function rangesFor(emphasis: IntralineRanges | null | undefined, side: 'left' | 'right'): CharRange[] | null {
  return (side === 'left' ? emphasis?.before : emphasis?.after) ?? null;
}

function drawnLineKeys(lines: DiffLine[]): Set<string> {
  return new Set(lines.filter((line) => !line.fold).map((line) => handleKey(line.side, line.row)));
}

// The other side's fold shows here only when this column doesn't draw that side's line.
function handleOf(line: DiffLine, handles: Map<string, FoldControl>, drawn: Set<string>): FoldControl | null {
  if (line.kind === 'truncated') return null;
  const own = handles.get(handleKey(line.side, line.row));
  if (own) return own;
  const other = handleKey(line.side === 'left' ? 'right' : 'left', line.row);
  return drawn.has(other) ? null : (handles.get(other) ?? null);
}

function editStarter(rows: DiffRow[], index: number, onEditBlock?: (rowIndex: number) => void) {
  if (!onEditBlock) return undefined;
  const hunk = rows[index]?.kind === 'hunk';
  if (hunk && !hunkHasEditableLines(rows, index)) return undefined;
  return () => onEditBlock(index + (hunk ? 1 : 0));
}

function draftStarter(rows: DiffRow[], line: DiffLine, draftThreadAt?: SideProps['draftThreadAt']) {
  const target = draftTarget(rows[line.row], line);
  if (!draftThreadAt || !target) return undefined;
  return draftThreadAt(target.line, target.side) ?? undefined;
}

// GitHub wants RIGHT for unchanged lines; LEFT is only for deletions.
function draftTarget(row: DiffRow | undefined, line: DiffLine): { line: number; side: 'left' | 'right' } | null {
  if (!row || line.blank) return null;
  const side = line.side === 'left' && row.kind === 'context' ? 'right' : line.side;
  const cell = row[side];
  return cell ? { line: cell.line, side } : null;
}

function DiffLineView({
  line,
  labels,
  lineTokens,
  ranges,
  expand,
  handle,
  wrap,
  stackMargins,
  height,
  editable,
  onEdit,
  pointer,
  onUntruncate,
  onDraft,
}: {
  line: DiffLine;
  labels: boolean;
  lineTokens: ThemedToken[] | null;
  ranges: CharRange[] | null;
  expand: HunkControl;
  handle: FoldControl | null;
  wrap: boolean;
  stackMargins: boolean;
  height: number;
  editable?: boolean;
  onEdit?: () => void;
  pointer?: CodePointer;
  onUntruncate?: (run: number) => void;
  onDraft?: () => void;
}) {
  const { cell, side } = line;
  if (line.kind === 'truncated') {
    return <TruncatedStrip count={line.truncated} onExpand={() => onUntruncate?.(line.row)} />;
  }
  if (line.kind === 'hunk') {
    return <HunkLine label={labels ? line.label : ''} expand={expand} onEdit={editable && side === 'right' ? onEdit : undefined} />;
  }
  const short = line.blank || line.semiblank !== null;
  const wrapping = wrap && !short;
  const row = rowClass(line, wrapping);
  const sized = rowSize(line, wrapping, height);
  if (!cell) return <div className={`${row} bg-procgen/40`} style={sized} />;
  const changed = line.kind === 'change';
  const openable = Boolean(editable && side === 'right');
  const margins = stackMargins ? commentMargins(cell.text, lineTokens) : [];
  const segments = withMargins(codeSegments(cell.text, lineTokens, changed ? ranges : null), margins);
  const tones = rowTones(line.kind === 'change', line.touched, side);
  return (
    <div
      {...{ [ROW_ATTR]: line.row }}
      className={`group ${row} ${tones.row} hover:row-shade ${openable ? 'cursor-text' : ''}`}
      style={sized}
      onClick={openable ? editClick(onEdit) : undefined}
    >
      <GutterCell line={short ? null : cell.line} handle={handle} tone={tones.gutter} short={short} onDraft={onDraft} />
      <span
        {...{ [WRAPPED_CELL]: `${side}:${line.row}` }}
        className={codeClass(line, wrapping)}
        style={wrapping ? hangingIndentStyle(cell.text) : undefined}
        onClick={pointer ? (event) => pointer.press(line, event) : undefined}
        onMouseMove={pointer ? (event) => pointer.move(line, event) : undefined}
        onMouseLeave={pointer?.leave}
      >
        <CodeText segments={segments} side={side} />
      </span>
    </div>
  );
}

function FoldSummaryRow({ fold, side, rows, tokens }: { fold: FoldLine; side: 'left' | 'right'; rows: DiffRow[]; tokens: SideTokens | null }) {
  const { control, summary, primary } = fold;
  if (!summary) return <div className={`${ROW} bg-procgen/40`} />;
  const tones = rowTones(control.fold.summaryChanged, false, side);
  const preview = primary ? collapsedPreview(rows, control.fold, side) : '';
  return (
    <div
      {...{ [ROW_ATTR]: control.fold.first }}
      className={`group ${ROW} row-folded ${tones.row} cursor-pointer hover:row-shade`}
      onClick={() => !window.getSelection()?.toString() && control.toggle()}
    >
      <GutterCell line={summary.line} handle={primary ? control : null} tone={tones.gutter} short={false} />
      <span className={FOLDED_TEXT}>
        <span className={CLIPPED_CODE}>
          <SummaryText parts={summaryParts(summary, side, rows, tokens)} side={side} />
        </span>
        {preview && <span className={FOLD_PREVIEW}>{preview}</span>}
      </span>
      {primary && <FoldBadge control={control} />}
    </div>
  );
}

function rowClass(line: DiffLine, wrapping: boolean): string {
  if (line.blank) return BLANK_ROW;
  if (line.semiblank) return SEMIBLANK_ROW;
  return wrapping ? WRAPPED_ROW : ROW;
}

function rowSize(line: DiffLine, wrapping: boolean, height: number): CSSProperties | undefined {
  if (line.blank) return { height, lineHeight: `${height}px` };
  if (line.semiblank) return { height };
  return wrapping ? { minHeight: height } : undefined;
}

function codeClass(line: DiffLine, wrapping: boolean): string {
  if (line.semiblank) return `${CODE} ${SEMIBLANK_CODE[line.semiblank]}`;
  return wrapping ? WRAPPED_CODE : CODE;
}

function editClick(onEdit?: () => void) {
  return (event: MouseEvent<HTMLElement>) => opensEditor(event.detail) && onEdit?.();
}

function toggles(control: FoldControl) {
  return (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    control.toggle();
  };
}

// Full-strength gutter tint keeps the change legible over the faded code.
function rowTones(changed: boolean, touched: boolean, side: 'left' | 'right'): { row: string; gutter: string } {
  if (!changed) return { row: touched ? TOUCHED_MARK : '', gutter: '' };
  return { row: `${faintBackground(side)} ${changeInk(side)}`, gutter: changeBackground(side) };
}

function faintBackground(side: 'left' | 'right'): string {
  return side === 'left' ? 'bg-del-bg/40' : 'bg-add-bg/40';
}

function CodeText({ segments, side }: { segments: CodeSegment[]; side: 'left' | 'right' }) {
  return segments.map((segment, at) => <SegmentSpan key={at} segment={segment} side={side} />);
}

function SummaryText({ parts, side }: { parts: SummaryPart[]; side: 'left' | 'right' }) {
  return parts.map((part, index) =>
    part.kind === 'node' ? <Fragment key={index}>{part.node}</Fragment> : <CodeText key={index} segments={part.segments} side={side} />,
  );
}

// Negative text-indent pulls the first line back out of the padding the continuations sit in.
function hangingIndentStyle(text: string): { paddingLeft: string; textIndent: string } {
  const indent = hangingIndent(text);
  return { paddingLeft: `${indent}ch`, textIndent: `-${indent}ch` };
}

function opensEditor(clickCount: number): boolean {
  return clickCount >= 3 || (diffEditModeOn() && !window.getSelection()?.toString());
}

function TruncatedStrip({ count, onExpand }: { count: number; onExpand: () => void }) {
  return (
    <SelectableRow onActivate={onExpand} expanded={false} className={TRUNCATED_STRIP}>
      <span aria-hidden className="text-[11px]">▸</span>
      <span>truncated {plural(count, 'line')}</span>
    </SelectableRow>
  );
}

function FoldBadge({ control }: { control: FoldControl }) {
  const { addedLines, deletedLines, kind, foldedLines } = control.fold;
  return (
    <button type="button" onClick={toggles(control)} title={kind.replace(/_/g, ' ')} className={FOLD_BADGE}>
      <span className="not-italic text-ink">{foldedLines}</span>
      {deletedLines > 0 && <span className="not-italic text-del-ink"> −{deletedLines}</span>}
      {addedLines > 0 && <span className="not-italic text-add-ink"> +{addedLines}</span>}
      {control.hiddenThreads > 0 && <span> · {plural(control.hiddenThreads, 'thread')}</span>}
    </button>
  );
}

function GutterCell({
  line,
  handle,
  tone,
  short,
  onDraft,
}: {
  line: number | null;
  handle: FoldControl | null;
  tone: string;
  short: boolean;
  onDraft?: () => void;
}) {
  const collapses = handle && !handle.collapsed ? handle : null;
  return (
    <span
      className={`${GUTTER} ${tone ? `${TONED_GUTTER} ${tone}` : ''} ${collapses ? FOLDING_GUTTER : ''}`}
      onClick={collapses ? toggles(collapses) : undefined}
    >
      {onDraft && <DraftThreadButton onDraft={onDraft} short={short} />}
      <span className="min-w-0 flex-1 text-right">{line}</span>
      {/* flex, not inline: an inline-block button leaves a baseline gap that unsettles a wrapped row. */}
      <span className="flex w-4 shrink-0 justify-center">{handle && <CollapseChevron control={handle} short={short} />}</span>
    </span>
  );
}

function DraftThreadButton({ onDraft, short }: { onDraft: () => void; short: boolean }) {
  return (
    <button
      type="button"
      aria-label="Comment on this line"
      onClick={(event) => {
        event.stopPropagation();
        onDraft();
      }}
      className={`${DRAFT_BTN} ${short ? 'h-[7.5px]' : 'h-[15px]'}`}
    >
      +
    </button>
  );
}

function CollapseChevron({ control, short }: { control: FoldControl; short: boolean }) {
  return (
    <button
      type="button"
      onClick={toggles(control)}
      aria-label={control.collapsed ? 'Expand code block' : 'Collapse code block'}
      className={`${short ? 'h-[7.5px] leading-[7.5px]' : 'h-[15px] leading-[15px]'} w-4 shrink-0 text-[13px] text-ink-dim hover:text-ink ${
        control.collapsed ? '' : 'opacity-40 group-hover:opacity-100'
      }`}
    >
      {control.collapsed ? '▸' : '▾'}
    </button>
  );
}

export function lineTone(side: 'left' | 'right', changed: boolean): string {
  return changed ? `${changeBackground(side)} ${changeInk(side)}` : '';
}

function changeBackground(side: 'left' | 'right'): string {
  return side === 'left' ? 'bg-del-bg' : 'bg-add-bg';
}

function changeInk(side: 'left' | 'right'): string {
  return side === 'left' ? 'text-del-ink' : 'text-add-ink';
}

function HunkLine({ label, expand, onEdit }: { label: string; expand: HunkControl; onEdit?: () => void }) {
  const edit = onEdit ? (
    <HoverCardTrigger label="Edit this hunk and commit the change" focusable={false} tooltipStyle>
      <button type="button" onClick={onEdit} className={EDIT_BTN}>
        edit
      </button>
    </HoverCardTrigger>
  ) : null;
  const body = (
    <>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {expand.hint && (
        <span className="flex shrink-0 items-center gap-1 text-ink-dim/80">
          <span aria-hidden className="text-[11px]">{expand.expanded ? '▾' : '▸'}</span>
          {expand.hint}
        </span>
      )}
    </>
  );
  const line = `${STRIP} w-full`;
  if (!expand.onToggle) {
    return (
      <div className={line}>
        {body}
        {edit}
      </div>
    );
  }
  return (
    <div className={`${ROW} w-full bg-procgen text-[9px] text-ink-dim`}>
      <SelectableRow onActivate={expand.onToggle} expanded={expand.expanded} className={`${STRIP} min-w-0 flex-1 hover:bg-btn-hover`}>
        {body}
      </SelectableRow>
      {edit}
    </div>
  );
}
