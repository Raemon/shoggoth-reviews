'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { repoRoute } from '@/features/codebases/repoPaths';
import { repoFilesPath } from '@/features/pull-requests/pullPaths';
import type { RepoFileSet } from '@/features/pull-requests/repoFiles';
import { useGithubToken, useStoreReady } from '@/features/sources/sourceStore';
import { useCachedJson } from '@/features/sources/useCachedJson';
import { MapCanvas } from './MapCanvas';
import { MapSidebar } from './MapSidebar';
import { buildMap, type MapLayout, type MapNode } from './mapLayout';
import { sourceFileSet } from './mapFiles';
import { useMapPreviews } from './useMapPreviews';
import styles from './codebaseMap.module.css';

export function CodebaseMap({ owner, repo }: { owner: string; repo: string }) {
  const token = useGithubToken();
  const ready = useStoreReady();
  const { data, error, reload } = useCachedJson<RepoFileSet>(repoFilesPath(owner, repo), token, ready);
  const [includeAssets, setIncludeAssets] = useState(false);
  return (
    <section className={styles.page} aria-label={`${owner}/${repo} code map`}>
      <div className={styles.titlebar}>
        <h1>Code map</h1><span className={styles.repoName}>{owner}/{repo}</span>
        <label className={styles.assetsToggle}><input type="checkbox" checked={includeAssets} onChange={(event) => setIncludeAssets(event.target.checked)} /> Include assets</label>
        <Link href={repoRoute(owner, repo)}>Back to repository</Link>
      </div>
      {error && <div className={styles.notice} role="alert">{error} <button onClick={() => void reload().catch(() => {})}>Retry</button></div>}
      {!data && !error && <div className={styles.loading} role="status">Mapping repository…<span>Loading folders and file sizes</span></div>}
      {data && <MapRepository key={`${owner}/${repo}/${data.sha}`} owner={owner} repo={repo} fileSet={data} includeAssets={includeAssets} />}
    </section>
  );
}

interface RepositoryProps { owner: string; repo: string; fileSet: RepoFileSet }

function MapRepository({ owner, repo, fileSet, includeAssets }: RepositoryProps & { includeAssets: boolean }) {
  const previews = useMapPreviews(owner, repo, fileSet.sha);
  const layout = useMemo(() => buildMap(sourceFileSet(fileSet, includeAssets)), [fileSet, includeAssets]);
  return <MapWorkspace key={String(includeAssets)} owner={owner} repo={repo} fileSet={fileSet} layout={layout} previews={previews} />;
}

function MapWorkspace({ owner, repo, fileSet, layout, previews }: RepositoryProps & { layout: MapLayout; previews: ReturnType<typeof useMapPreviews> }) {
  const [selected, setSelected] = useState<MapNode | null>(null);
  const [focus, setFocus] = useState<MapNode | null>(null);
  const [query, setQuery] = useState('');
  const jump = (node: MapNode) => { setSelected(node); setFocus({ ...node }); };
  const scene = useMemo(() => ({ root: layout.root, selected: selected?.path ?? null, query: query.trim().toLowerCase(), previews: previews.files, loading: previews.loading }), [layout, selected, query, previews.files, previews.loading]);
  return (
    <>
      <MapBreadcrumbs layout={layout} selected={selected} onSelect={jump} />
      {fileSet.truncated && <div className={styles.notice}>GitHub returned a partial tree. This map shows {fileSet.files.length.toLocaleString()} available files.</div>}
      {previews.error && <div className={styles.notice} role="alert">Code previews: {previews.error} <button onClick={previews.retry}>Retry</button></div>}
      {previews.tooLarge && <div className={styles.notice}>Some code previews exceeded the repository preview limits. Select a file to read it individually.</div>}
      <div className={styles.workspace}>
        <MapCanvas scene={scene} focus={focus} onSelect={setSelected} />
        <MapSidebar owner={owner} repo={repo} sha={fileSet.sha} layout={layout} selected={selected} query={query} onQuery={setQuery} onSelect={jump} />
      </div>
      <footer className={styles.statusbar}>
        <span>{layout.files.length.toLocaleString()} of {fileSet.files.length.toLocaleString()} files <span className={styles.muted}>at {fileSet.sha.slice(0, 7)}</span></span>
        <span className={styles.areaNote}>Area follows file size, compressed for readability</span>
        <span role="status" aria-label="Code preview loading">{previews.loading ? `Loading folded code… ${previews.files.size.toLocaleString()} files` : `${previews.files.size.toLocaleString()} folded code previews`}</span>
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
