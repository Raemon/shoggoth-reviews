'use client';

import { Fragment, useLayoutEffect, useMemo, useRef, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { hunkHasEditableLines, type EditableBlock } from './editableBlocks';
import { codeSegments, type DimmedSegment, type SegmentRole } from './codeSegments';
import { collapsedSegments, expandedSegments, foldLayout, type FoldLayout } from './foldDimming';
import { abbreviatedLength } from './keywordAbbreviations';
import { collapsedPreview } from './collapsedPreview';
import { diffEditModeOn } from './editModeStore';
import { foldsCollapsed, useFoldCommand } from './foldModeStore';
import type { DiffLine } from './diffLines';
import type { ThemedToken } from './diffHighlight';
import type { CharRange, IntralineRanges } from './intralineDiff';
import type { DiffRow } from './splitDiff';
import type { CollapseAnchor } from './useCodeCollapse';
import type { CodePointer } from './useDefinitionPointer';
import type { SideTokens } from './useDiffSideHighlight';
import { COLLAPSED_ROW_GAP, collapsedRowGap, lineHeight, type RowHeights } from './diffMetrics';
import { ROW_ATTR } from './litRow';
import { hangingIndent, measureRowHeights, sameRowHeights, WRAPPED_CELL } from './rowHeights';
import { HoverCardTrigger } from '@/features/surface-ui/HoverCard';
import { plural } from '@/features/surface-ui/plural';
import { SelectableRow } from '@/features/surface-ui/SelectableRow';

const ROW = 'flex h-[15px] items-center gap-1 leading-[15px]';
const WRAPPED_ROW = 'flex min-h-[15px] items-start gap-1 leading-[15px]';
// Literal px; Tailwind can't compile computed classes. Sync with BLANK_ROW_HEIGHT.
const BLANK_ROW = 'flex h-[2px] items-center gap-1 leading-[2px]';
const GUTTER = 'relative flex w-[52px] shrink-0 select-none items-center pr-1 text-[9px] text-ink-dim';
const FOLDING_GUTTER = 'cursor-pointer hover:text-ink';
const TONED_GUTTER = 'self-stretch group-hover:row-shade group-[.diff-line-lit]:row-lit';
const DRAFT_BTN =
  'absolute left-0 flex h-[15px] w-[11px] items-center justify-center rounded-sm bg-btn text-[10px] leading-none text-ink-dim opacity-0 hover:bg-btn-hover hover:text-ink focus-visible:opacity-100 group-hover:opacity-100';
const TOUCHED_MARK = 'bg-add-bg/60 shadow-[inset_2px_0_0_var(--add-emph)]';
const STICKY_CHIP = 'sticky right-0 shrink-0 rounded bg-procgen px-1 hover:bg-btn-hover hover:text-ink';
const EDIT_BTN = `${STICKY_CHIP} uppercase tracking-[0.14em]`;
const FOLD_BADGE = `${STICKY_CHIP} ml-auto text-[9px] italic text-ink-dim`;
const FOLD_PREVIEW = 'diff-code hidden max-w-[90ch] shrink-[999] overflow-hidden text-ellipsis whitespace-pre pl-2 text-[11px] text-ink-dim/70 group-hover:block';
const CODE = 'diff-code whitespace-pre pr-2 text-[11px]';
// break-word, so only a word too long for a whole line is ever split.
const WRAPPED_CODE = 'diff-code min-w-0 flex-1 whitespace-pre-wrap [overflow-wrap:break-word] [tab-size:8] pr-2 text-[11px]';
// 100px keeps the fold badge clear of the ellipsis; 100cqw is the visible column width.
const FOLDED_TEXT = 'flex min-w-0 max-w-[calc(100cqw-100px)] overflow-hidden';
const STRIP = `${ROW} bg-procgen px-1 text-left text-[9px] text-ink-dim`;
const TRUNCATED_STRIP = `${STRIP} w-full italic hover:bg-btn-hover hover:text-ink`;
const PREFIX_FONT = 9;

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
  anchors: Map<number, CollapseAnchor>;
  editable?: boolean;
  onEditBlock?: (rowIndex: number) => void;
  editor?: ReactNode;
  editedRows?: EditableBlock | null;
  spacer?: { afterRow: number; height: number } | null;
  pointer?: CodePointer;
  wrap: boolean;
  heights: RowHeights;
  onMeasured: (heights: RowHeights) => void;
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
  const { lines, tokens, anchors, editedRows, editor } = props;
  const dim = foldsCollapsed(useFoldCommand().mode);
  const longestPrefix = useMemo(() => (dim ? longestFoldedPrefix(lines, tokens, anchors) : 0), [dim, lines, tokens, anchors]);
  const folding = { dim, longestPrefix };
  if (!editedRows) return <DiffLines {...props} {...folding} from={0} to={lines.length} />;
  const edited = editedLineRange(lines, editedRows);
  return (
    <>
      <DiffLines {...props} {...folding} from={0} to={edited.first} />
      {editor}
      <DiffLines {...props} {...folding} from={edited.last + 1} to={lines.length} />
    </>
  );
}

function longestFoldedPrefix(lines: DiffLine[], tokens: SideTokens | null, anchors: Map<number, CollapseAnchor>): number {
  let longest = 0;
  for (const line of lines) {
    if (!anchors.get(line.row)?.collapsed) continue;
    const layout = foldLayout(line.cell ? (tokens?.[line.side][line.row] ?? null) : null);
    if (layout) longest = Math.max(longest, abbreviatedLength(layout.prefix));
  }
  return longest;
}

// Only top-level, unchanged lines fold: a changed line's change is usually in its tail.
function foldsTail(line: DiffLine, collapsed: boolean, layout: FoldLayout): boolean {
  if (layout.prefix.length === 0) return false;
  return collapsed || (line.kind !== 'change' && layout.indent === 0);
}

/** No dep array: every render can rewrap, and a resize does so without one. */
function useMeasuredRows(pane: React.RefObject<HTMLElement | null>, wrapping: boolean, onMeasured: (heights: RowHeights) => void) {
  const held = useRef<RowHeights>(null);
  const report = (next: RowHeights) => {
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
  const covered = lines.flatMap((line, index) => (line.row >= block.firstRow && line.row <= block.lastRow ? [index] : []));
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
  anchors,
  editable,
  onEditBlock,
  spacer,
  pointer,
  wrap,
  heights,
  onUntruncate,
  draftThreadAt,
  dim,
  longestPrefix,
}: SideProps & { from: number; to: number; dim: boolean; longestPrefix: number }) {
  if (from >= to) return null;
  const spacerLine = spacer ? lastLineOfRow(lines, spacer.afterRow) : -1;
  const rowsWithRightLine = rowsShownOnRight(lines);
  return (
    <div className={`@container min-w-0 flex-1 ${wrap ? '' : 'overflow-x-auto'}`}>
      <div className={wrap ? 'w-full' : 'w-max min-w-full'}>
        {lines.slice(from, to).map((line, offset) => {
          const index = from + offset;
          const anchor = anchorOf(line, anchors, rowsWithRightLine);
          const gap = collapsedRowGap(line, lines[index + 1], anchors);
          return (
            <Fragment key={index}>
              <DiffLineView
                line={line}
                labels={labels}
                preview={previewFor(rows, line, anchor)}
                lineTokens={tokens?.[line.side][line.row] ?? null}
                ranges={rangesFor(emphasis[line.row], line.side)}
                expand={expand}
                anchor={anchor}
                collapsed={anchors.get(line.row)?.collapsed ?? false}
                dim={dim}
                longestPrefix={longestPrefix}
                wrap={wrap}
                height={heights ? lineHeight(line, heights) : null}
                editable={editable}
                onEdit={editStarter(rows, line.row, onEditBlock)}
                pointer={pointer}
                onUntruncate={onUntruncate}
                onDraft={draftStarter(rows, line, draftThreadAt)}
              />
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

function rowsShownOnRight(lines: DiffLine[]): Set<number> {
  return new Set(lines.filter((line) => line.side === 'right').map((line) => line.row));
}

function previewFor(rows: DiffRow[], line: DiffLine, anchor: CollapseAnchor | null): string {
  return anchor?.collapsed ? collapsedPreview(rows, anchor.region, line.side) : '';
}

function anchorOf(line: DiffLine, anchors: Map<number, CollapseAnchor>, rowsWithRightLine: Set<number>): CollapseAnchor | null {
  if (line.kind === 'truncated') return null;
  if (line.side === 'left' && rowsWithRightLine.has(line.row)) return null;
  return anchors.get(line.row) ?? null;
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
  anchor,
  collapsed,
  preview,
  dim,
  longestPrefix,
  wrap,
  height,
  editable,
  onEdit,
  pointer,
  onUntruncate,
  onDraft,
}: {
  line: DiffLine;
  labels: boolean;
  preview: string;
  lineTokens: ThemedToken[] | null;
  ranges: CharRange[] | null;
  expand: HunkControl;
  anchor: CollapseAnchor | null;
  collapsed: boolean;
  dim: boolean;
  longestPrefix: number;
  wrap: boolean;
  height: number | null;
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
  const wrapping = wrap && !line.blank;
  const row = line.blank ? BLANK_ROW : wrapping ? WRAPPED_ROW : ROW;
  const sized = wrapping && height !== null ? { minHeight: height } : undefined;
  if (!cell) return <div className={`${row} bg-procgen/40`} style={sized} />;
  const changed = line.kind === 'change';
  const openable = Boolean(editable && side === 'right');
  const raw = codeSegments(cell.text, lineTokens, changed ? ranges : null);
  const layout = dim ? foldLayout(lineTokens) : null;
  const folded = layout !== null && foldsTail(line, collapsed, layout);
  const segments = collapsed ? collapsedSegments(raw, layout, longestPrefix) : expandedSegments(raw, layout);
  const fold = folded ? prefixStyle(longestPrefix) : null;
  const tones = rowTones(line, collapsed);
  return (
    <div
      {...{ [ROW_ATTR]: line.row }}
      className={`group ${row} ${tones.row} hover:row-shade ${rowCursor(collapsed, openable)}`}
      style={sized}
      onClick={rowClick(collapsed ? anchor : null, openable ? onEdit : undefined)}
    >
      <GutterCell line={line.blank ? null : cell.line} anchor={anchor} tone={tones.gutter} onDraft={onDraft} />
      <span className={collapsed ? FOLDED_TEXT : 'contents'}>
        <span
          {...{ [WRAPPED_CELL]: `${side}:${line.row}` }}
          className={codeClass(collapsed, wrapping)}
          style={wrapping && !collapsed ? hangingIndentStyle(cell.text) : undefined}
          onClick={pointer && !collapsed ? (event) => pointer.press(line, event) : undefined}
          onMouseMove={pointer ? (event) => pointer.move(line, event) : undefined}
          onMouseLeave={pointer?.leave}
        >
          <CodeText segments={segments} side={side} fold={fold} />
        </span>
        {preview && <span className={FOLD_PREVIEW}>{preview}</span>}
      </span>
      {collapsed && anchor && <FoldBadge anchor={anchor} />}
    </div>
  );
}

// One column for the pane's prefixes, as wide as the longest collapsed row's.
function prefixStyle(longest: number): CSSProperties {
  return { fontSize: PREFIX_FONT, minWidth: `${longest}ch` };
}

function rowCursor(collapsed: boolean, openable: boolean): string {
  if (collapsed) return 'cursor-pointer';
  return openable ? 'cursor-text' : '';
}

function rowClick(expands: CollapseAnchor | null, onEdit?: () => void) {
  if (expands) return () => !window.getSelection()?.toString() && expands.toggle();
  if (onEdit) return (event: MouseEvent<HTMLElement>) => opensEditor(event.detail) && onEdit();
  return undefined;
}

function toggles(anchor: CollapseAnchor) {
  return (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    anchor.toggle();
  };
}

// Full-strength gutter tint keeps the change legible over the faded code.
function rowTones(line: DiffLine, collapsed: boolean): { row: string; gutter: string } {
  const folded = collapsed ? 'row-folded' : '';
  if (line.kind !== 'change') return { row: `${line.touched ? TOUCHED_MARK : ''} ${folded}`, gutter: '' };
  return { row: `${faintBackground(line.side)} ${changeInk(line.side)} ${folded}`, gutter: changeBackground(line.side) };
}

function faintBackground(side: 'left' | 'right'): string {
  return side === 'left' ? 'bg-del-bg/40' : 'bg-add-bg/40';
}

interface RoleGroup {
  role: SegmentRole | undefined;
  segments: DimmedSegment[];
}

function groupedByRole(segments: DimmedSegment[]): RoleGroup[] {
  const groups: RoleGroup[] = [];
  for (const segment of segments) {
    const open = groups[groups.length - 1];
    if (open && open.role === segment.role) open.segments.push(segment);
    else groups.push({ role: segment.role, segments: [segment] });
  }
  return groups;
}

function CodeText({ segments, side, fold }: { segments: DimmedSegment[]; side: 'left' | 'right'; fold: CSSProperties | null }) {
  const pieces = (group: DimmedSegment[]) => group.map((segment, at) => <SegmentSpan key={at} segment={segment} side={side} />);
  if (!fold) return pieces(segments);
  return groupedByRole(segments).map((group, index) => (
    <RoleSpan key={index} role={group.role} prefix={fold}>
      {pieces(group.segments)}
    </RoleSpan>
  ));
}

function SegmentSpan({ segment, side }: { segment: DimmedSegment; side: 'left' | 'right' }) {
  return (
    <span hidden={segment.elided} className={segment.emphasized ? emphasisTone(side) : undefined} style={{ ...segment.style, opacity: segment.opacity }}>
      {segment.content}
    </span>
  );
}

// The tail stays in the DOM while hidden so click offsets still match the source line.
function RoleSpan({ role, prefix, children }: { role: SegmentRole | undefined; prefix: CSSProperties; children: ReactNode }) {
  if (role === 'prefix') return <span className="inline-block indent-0" style={prefix}>{children}</span>;
  if (role === 'tail') return <span className="hidden group-hover:inline">{children}</span>;
  return children;
}

// A collapsed row shows one ellipsised line, so it neither wraps nor hangs.
function codeClass(collapsed: boolean, wrapping: boolean): string {
  if (collapsed) return `${CODE} min-w-0 overflow-hidden text-ellipsis`;
  return wrapping ? WRAPPED_CODE : CODE;
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

function FoldBadge({ anchor }: { anchor: CollapseAnchor }) {
  const { addedLines, deletedLines, kind, start, end } = anchor.region;
  return (
    <button type="button" onClick={toggles(anchor)} title={kind.replace(/_/g, ' ')} className={FOLD_BADGE}>
      <span className="not-italic text-ink">{end - start}</span>
      {deletedLines > 0 && <span className="not-italic text-del-ink"> −{deletedLines}</span>}
      {addedLines > 0 && <span className="not-italic text-add-ink"> +{addedLines}</span>}
      {anchor.hiddenThreads > 0 && <span> · {plural(anchor.hiddenThreads, 'thread')}</span>}
    </button>
  );
}

function GutterCell({
  line,
  anchor,
  tone,
  onDraft,
}: {
  line: number | null;
  anchor: CollapseAnchor | null;
  tone: string;
  onDraft?: () => void;
}) {
  const collapses = anchor && !anchor.collapsed ? anchor : null;
  return (
    <span
      className={`${GUTTER} ${tone ? `${TONED_GUTTER} ${tone}` : ''} ${collapses ? FOLDING_GUTTER : ''}`}
      onClick={collapses ? toggles(collapses) : undefined}
    >
      {onDraft && <DraftThreadButton onDraft={onDraft} />}
      <span className="min-w-0 flex-1 text-right">{line}</span>
      {/* flex, not inline: an inline-block button leaves a baseline gap that unsettles a wrapped row. */}
      <span className="flex w-4 shrink-0 justify-center">{anchor && <CollapseChevron anchor={anchor} />}</span>
    </span>
  );
}

function DraftThreadButton({ onDraft }: { onDraft: () => void }) {
  return (
    <button
      type="button"
      aria-label="Comment on this line"
      onClick={(event) => {
        event.stopPropagation();
        onDraft();
      }}
      className={DRAFT_BTN}
    >
      +
    </button>
  );
}

function CollapseChevron({ anchor }: { anchor: CollapseAnchor }) {
  return (
    <button
      type="button"
      onClick={toggles(anchor)}
      aria-label={anchor.collapsed ? 'Expand code block' : 'Collapse code block'}
      className={`h-[15px] w-4 shrink-0 text-[13px] leading-[15px] text-ink-dim hover:text-ink ${
        anchor.collapsed ? '' : 'opacity-40 group-hover:opacity-100'
      }`}
    >
      {anchor.collapsed ? '▸' : '▾'}
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

function emphasisTone(side: 'left' | 'right'): string {
  return side === 'left' ? 'bg-del-emph' : 'bg-add-emph';
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
