'use client';

import { useMemo, useState } from 'react';
import { fileTextPath } from '@/features/pull-requests/pullPaths';
import type { FileText } from '@/features/pull-requests/pullRequests';
import { CodeTokens, langForPath, useTokenized } from '@/features/pull-requests/diffHighlight';
import { useGithubToken, useStoreReady } from '@/features/sources/sourceStore';
import { useCachedJson } from '@/features/sources/useCachedJson';
import { formatBytes, type MapNode } from './mapLayout';
import { isMapAsset } from './mapFiles';
import styles from './codebaseMap.module.css';

export default function MapSource({ owner, repo, sha, node }: {
  owner: string; repo: string; sha: string; node: MapNode;
}) {
  const token = useGithubToken();
  const ready = useStoreReady();
  const skipped = unavailableSource(node);
  const { data, error, reload } = useCachedJson<FileText>(skipped ? null : fileTextPath(owner, repo, sha, node.path), token, ready);
  const text = data?.text != null && !data.text.includes('\0') ? data.text : null;
  return (
    <section className={styles.source} aria-label={`Source of ${node.path}`}>
      <div className={styles.sourceHeading}><h2 title={node.path}>{node.name}</h2><span>{formatBytes(data?.byteSize ?? node.bytes)}</span></div>
      {skipped && <p className={styles.message}>{skipped}</p>}
      {!skipped && error && <p className={styles.message} role="alert">{error} <button onClick={() => void reload().catch(() => {})}>Retry</button></p>}
      {!skipped && !data && !error && <p className={styles.message} role="status">Loading source…</p>}
      {data && text === null && <p className={styles.message}>Binary or oversized file. Source preview is unavailable.</p>}
      {text !== null && <SourceCode text={text} path={node.path} />}
    </section>
  );
}

function SourceCode({ text, path }: { text: string; path: string }) {
  const [limit, setLimit] = useState(400);
  const lines = useMemo(() => text.split('\n'), [text]);
  const shown = lines.slice(0, limit);
  const shownText = shown.join('\n');
  const canHighlight = shownText.length <= 60_000;
  const tokens = useTokenized(canHighlight ? shownText : '', canHighlight ? langForPath(path) : null);
  return (
    <div className={styles.sourceScroll}>
      {text === '' ? <p className={styles.message}>Empty file.</p> : <pre className="diff-code">{shown.map((line, index) => <div key={index}><span className={styles.lineNumber} aria-hidden="true">{index + 1}</span><CodeTokens text={line} tokens={canHighlight ? tokens?.[index] ?? null : null} /></div>)}</pre>}
      {lines.length > limit && <button className={styles.moreLines} onClick={() => setLimit(limit + 400)}>Show 400 more lines ({lines.length.toLocaleString()} total)</button>}
    </div>
  );
}

function unavailableSource(node: MapNode): string | null {
  if (isMapAsset(node.path)) return 'Binary asset. Its location and size are shown on the map.';
  return node.bytes > 512_000 ? 'Source exceeds the 500 KB preview limit. Its location and size are shown on the map.' : null;
}
