'use client';

import { useCallback } from 'react';
import { ChangeCounts } from './ChangeCounts';
import { useColumnNav } from './columnNav';
import { ROW_HEIGHT } from './diffMetrics';
import { FileDiff } from './FileDiff';
import { ImageDiff } from './ImageDiff';
import { isImagePath } from './imageFiles';
import { imageSides } from './imageView';
import { useNearViewport } from './nearViewportStore';
import type { ChangedFile } from './pullRequests';
import { CopyButton } from '@/features/surface-ui/CopyButton';
import { OpenOnGithubLink } from '@/features/surface-ui/OpenOnGithubLink';
import { PaneStatusLine } from '@/features/surface-ui/PaneStatusLine';
import { rowStateClass, type RowState } from '@/features/surface-ui/rowState';
import { SelectableRow } from '@/features/surface-ui/SelectableRow';

// revealed: the file stays folded, with only the blocks a reveal toggle asks for drawn.
export type FileView = 'open' | 'revealed' | 'closed';

const CHEVRON: Record<FileView, string> = { open: '▾', revealed: '▹', closed: '▸' };

const ACTION = 'rounded px-1 leading-4 hover:bg-btn-hover hover:text-ink';
const ACTION_BAR = 'flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100';

export function DiffFileSection({
  owner,
  repo,
  file,
  baseRef,
  headRef,
  selected,
  view,
  onToggle,
  sectionRef,
}: {
  owner: string;
  repo: string;
  file: ChangedFile;
  baseRef: string;
  headRef: string;
  selected: boolean;
  view: FileView;
  onToggle: () => void;
  sectionRef: (node: HTMLElement | null) => void;
}) {
  const row = useColumnNav('diff').row(file.filename, selected);
  const open = view === 'open';
  const [watchNear, near] = useNearViewport();
  // React takes this cleanup instead of calling the ref with null: let go of both here.
  const holdSection = useCallback(
    (element: HTMLElement | null) => {
      sectionRef(element);
      const unwatch = watchNear(element);
      return () => {
        unwatch?.();
        sectionRef(null);
      };
    },
    [sectionRef, watchNear],
  );
  return (
    <section ref={holdSection} className="border-b border-panel-edge">
      <div
        data-nav-cursor={row.props.cursor || undefined}
        onPointerEnter={row.props.onPointerEnter}
        className={`group sticky top-0 z-20 flex items-baseline gap-2 border-b border-panel-edge pr-2 text-[11px] leading-5 ${sectionTone(row.state)}`}
      >
        <SelectableRow
          {...row.props}
          onActivate={onToggle}
          expanded={open}
          className="flex min-w-0 flex-1 items-baseline gap-2 py-1.5 pl-2 text-left"
        >
          <span aria-hidden className="w-3 shrink-0 text-[11px] text-ink-dim">
            {CHEVRON[view]}
          </span>
          <span className="min-w-0 flex-1 truncate font-serif text-[14px]">
            {file.previousFilename && <span className="text-ink-dim">{file.previousFilename} → </span>}
            {file.filename}
          </span>
          <span className="shrink-0 text-[9px] uppercase tracking-[0.18em] text-ink-dim">{file.status}</span>
          <ChangeCounts additions={file.additions} deletions={file.deletions} />
        </SelectableRow>
        <HeaderActions path={file.filename} href={blobUrl(owner, repo, headRef, file.filename)} />
      </div>
      {view !== 'closed' &&
        (near ? (
          <FileBody owner={owner} repo={repo} file={file} baseRef={baseRef} headRef={headRef} revealedOnly={view === 'revealed'} />
        ) : (
          <div style={{ height: view === 'revealed' ? ROW_HEIGHT : unreadHeight(file) }} />
        ))}
    </section>
  );
}

function blobUrl(owner: string, repo: string, headRef: string, filename: string): string {
  return `https://github.com/${owner}/${repo}/blob/${headRef}/${filename}`;
}

function HeaderActions({ path, href }: { path: string; href: string }) {
  return (
    <span className={ACTION_BAR}>
      <CopyButton value={path} what="path" ariaLabel={`Copy path ${path}`} className={ACTION} idleClassName="text-ink-dim">
        ⧉
      </CopyButton>
      <OpenOnGithubLink href={href} label={path} className={`${ACTION} text-ink-dim`} />
    </span>
  );
}

// Rough stand-in for a file too far off screen to draw, so the scrollbar spans the diff.
function unreadHeight(file: ChangedFile): number {
  return Math.max(1, patchRowCount(file)) * ROW_HEIGHT;
}

function patchRowCount(file: ChangedFile): number {
  return file.patch ? file.patch.split('\n').length : file.additions + file.deletions;
}

function sectionTone(state: RowState): string {
  return state === 'plain' ? 'bg-panel text-ink' : rowStateClass(state);
}

function FileBody({
  owner,
  repo,
  file,
  baseRef,
  headRef,
  revealedOnly,
}: {
  owner: string;
  repo: string;
  file: ChangedFile;
  baseRef: string;
  headRef: string;
  revealedOnly: boolean;
}) {
  const diff = file.patch ? (
    <FileDiff owner={owner} repo={repo} file={file} baseRef={baseRef} headRef={headRef} revealedOnly={revealedOnly} />
  ) : null;
  if (revealedOnly) return diff;
  if (isImagePath(file.filename)) {
    const { before, after } = imageSides(file, baseRef, headRef);
    return (
      <>
        <ImageDiff owner={owner} repo={repo} before={before} after={after} />
        {diff}
      </>
    );
  }
  if (diff) return diff;
  return (
    <PaneStatusLine tone="dim" className="flex-1">
      {file.status} — no textual diff
    </PaneStatusLine>
  );
}
