'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { repoRoute } from '@/features/codebases/repoPaths';
import { repoFilesPath } from '@/features/pull-requests/pullPaths';
import type { RepoFileSet } from '@/features/pull-requests/repoFiles';
import { useGithubToken, useStoreReady } from '@/features/sources/sourceStore';
import { useCachedJson } from '@/features/sources/useCachedJson';
import { MapCanvas } from './MapCanvas';
import { MapSidebar } from './MapSidebar';
import { buildMap, type MapLayout, type MapNode } from './mapLayout';
import type { CodePreview } from './mapRenderer';
import styles from './codebaseMap.module.css';

export function CodebaseMap({ owner, repo }: { owner: string; repo: string }) {
  const token = useGithubToken();
  const ready = useStoreReady();
  const { data, error, reload } = useCachedJson<RepoFileSet>(repoFilesPath(owner, repo), token, ready);
  const layout = useMemo(() => data ? buildMap(data) : null, [data]);
  return (
    <section className={styles.page} aria-label={`${owner}/${repo} code map`}>
      <div className={styles.titlebar}>
        <h1>Code map</h1><span className={styles.repoName}>{owner}/{repo}</span>
        <Link href={repoRoute(owner, repo)}>Back to repository</Link>
      </div>
      {error && <div className={styles.notice} role="alert">{error} <button onClick={() => void reload().catch(() => {})}>Retry</button></div>}
      {!layout && !error && <div className={styles.loading} role="status">Mapping repository…<span>Loading folders and file sizes</span></div>}
      {layout && data && <MapWorkspace key={data.sha} owner={owner} repo={repo} fileSet={data} layout={layout} />}
    </section>
  );
}

function MapWorkspace({ owner, repo, fileSet, layout }: { owner: string; repo: string; fileSet: RepoFileSet; layout: MapLayout }) {
  const [selected, setSelected] = useState<MapNode | null>(null);
  const [focus, setFocus] = useState<MapNode | null>(null);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<ReadonlyMap<string, CodePreview>>(new Map());
  const preview = useCallback((path: string, code: CodePreview) => setExpanded((held) => rememberPreview(held, path, code)), []);
  const jump = (node: MapNode) => { setSelected(node); setFocus({ ...node }); };
  const scene = useMemo(() => ({ root: layout.root, selected: selected?.path ?? null, query: query.trim().toLowerCase(), expanded }), [layout, selected, query, expanded]);
  return (
    <>
      <MapBreadcrumbs layout={layout} selected={selected} onSelect={jump} />
      {fileSet.truncated && <div className={styles.notice}>GitHub returned a partial tree. This map shows {fileSet.files.length.toLocaleString()} available files.</div>}
      <div className={styles.workspace}>
        <MapCanvas scene={scene} focus={focus} onSelect={setSelected} />
        <MapSidebar owner={owner} repo={repo} sha={fileSet.sha} layout={layout} selected={selected} query={query} onQuery={setQuery} onSelect={jump} onPreview={preview} />
      </div>
      <footer className={styles.statusbar}>
        <span>{layout.files.length.toLocaleString()} files <span className={styles.muted}>at {fileSet.sha.slice(0, 7)}</span></span>
        <span className={styles.areaNote}>Area follows file size, compressed for readability</span>
        <button disabled={!expanded.size} onClick={() => setExpanded(new Map())}>Collapse code ({expanded.size})</button>
        <a href="https://x.com/rikarends/status/2098710248164868534" target="_blank" rel="noreferrer">Inspired by Rik Arends ↗</a>
      </footer>
    </>
  );
}

function MapBreadcrumbs({ layout, selected, onSelect }: { layout: MapLayout; selected: MapNode | null; onSelect: (node: MapNode) => void }) {
  const parts = selected?.path.split('/') ?? [];
  return (
    <nav className={styles.breadcrumbs} aria-label="Map location">
      <button onClick={() => onSelect(layout.root)}>Repository</button>
      {parts.filter(Boolean).map((part, index) => {
        const path = parts.slice(0, index + 1).join('/');
        return <span key={path}>/ <button onClick={() => onSelect(layout.byPath.get(path)!)} aria-current={path === selected?.path ? 'location' : undefined}>{part}</button></span>;
      })}
      {!selected && <span className={styles.muted}>/ all files, one canvas</span>}
    </nav>
  );
}

function rememberPreview(held: ReadonlyMap<string, CodePreview>, path: string, code: CodePreview): ReadonlyMap<string, CodePreview> {
  const next = new Map(held);
  next.delete(path);
  next.set(path, code);
  if (next.size > 8) next.delete(next.keys().next().value!);
  return next;
}
