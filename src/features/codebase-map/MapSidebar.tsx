'use client';

import { useDeferredValue, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { formatBytes, type MapLayout, type MapNode } from './mapLayout';
import { nodeColor, type CodePreview } from './mapRenderer';
import styles from './codebaseMap.module.css';

const MapSource = dynamic(() => import('./MapSource'), { loading: () => <p className={styles.message}>Loading reader…</p> });
const LIST_LIMIT = 100;

interface SidebarProps {
  owner: string; repo: string; sha: string;
  layout: MapLayout; selected: MapNode | null;
  query: string; onQuery: (query: string) => void;
  onSelect: (node: MapNode) => void;
  onPreview: (path: string, code: CodePreview) => void;
}

export function MapSidebar(props: SidebarProps) {
  const { owner, repo, sha, layout, selected, query, onQuery, onSelect, onPreview } = props;
  const deferred = useDeferredValue(query.trim().toLowerCase());
  const folder = selectedFolder(layout, selected);
  const results = useMemo(() => findNodes(layout, folder, deferred), [layout, folder, deferred]);
  return (
    <aside className={styles.sidebar} aria-label="Files and source inspector">
      <div className={styles.search}>
        <label htmlFor="map-search">Find a file</label>
        <input id="map-search" type="search" placeholder="Search paths…" value={query} onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter' && results[0]) onSelect(results[0]); }} />
      </div>
      <div className={styles.listHeading}><span>{deferred ? `${results.length.toLocaleString()} matches` : folder.name}</span><span>{deferred ? 'Enter to focus' : `${folder.count.toLocaleString()} files`}</span></div>
      <div className={styles.fileList}>
        {folder.path && !deferred && <button className={styles.fileRow} onClick={() => onSelect(parentNode(layout, folder))}>↑ Parent folder</button>}
        {results.slice(0, LIST_LIMIT).map((node) => <FileRow key={node.path} node={node} active={selected?.path === node.path} onSelect={onSelect} />)}
        {!results.length && <p className={styles.message}>{deferred ? 'No matching files. Try a shorter path.' : 'This repository has no files.'}</p>}
        {results.length > LIST_LIMIT && <p className={styles.message}>Showing the first {LIST_LIMIT}. Refine the search to find more.</p>}
      </div>
      {selected && !selected.directory ? (
        <MapSource key={`${sha}:${selected.path}`} owner={owner} repo={repo} sha={sha} node={selected} onPreview={onPreview} />
      ) : <MapGuide folder={folder} onSelect={onSelect} />}
    </aside>
  );
}

function FileRow({ node, active, onSelect }: { node: MapNode; active: boolean; onSelect: (node: MapNode) => void }) {
  return (
    <button className={styles.fileRow} onClick={() => onSelect(node)} aria-pressed={active} title={node.path}>
      <span className={styles.fileDot} style={{ background: nodeColor(node.path) }} />
      <span className={styles.filePath}>{node.directory ? '▸ ' : ''}{node.path}</span>
      <span className={styles.fileSize}>{node.directory ? node.count.toLocaleString() : formatBytes(node.bytes)}</span>
    </button>
  );
}

function MapGuide({ folder, onSelect }: { folder: MapNode; onSelect: (node: MapNode) => void }) {
  return (
    <div className={styles.guide}>
      <h2>{folder.path || 'Explore the codebase'}</h2>
      <p>{folder.count.toLocaleString()} files · {formatBytes(folder.bytes)}</p>
      <p>Folders contain files. Colors follow the top-level folders. Zoom into a neighborhood, then open a file to read its source.</p>
      <button onClick={() => onSelect(folder)}>Focus {folder.path ? 'folder' : 'repository'}</button>
      <dl><dt>Pan</dt><dd>Drag / arrow keys</dd><dt>Zoom</dt><dd>Scroll / pinch / + −</dd><dt>Focus</dt><dd>Double-click a tile</dd><dt>Reset</dt><dd>0 / Fit repo</dd></dl>
      <p className={styles.muted}>Source stays collapsed until selected. The map keeps previews of your last eight files.</p>
    </div>
  );
}

function findNodes(layout: MapLayout, folder: MapNode, query: string): MapNode[] {
  if (query) return layout.files.filter((node) => node.path.toLowerCase().includes(query));
  return folder.children;
}

function selectedFolder(layout: MapLayout, selected: MapNode | null): MapNode {
  if (!selected) return layout.root;
  return selected.directory ? selected : parentNode(layout, selected);
}

function parentNode(layout: MapLayout, node: MapNode): MapNode {
  return layout.byPath.get(node.path.slice(0, Math.max(0, node.path.lastIndexOf('/')))) ?? layout.root;
}
