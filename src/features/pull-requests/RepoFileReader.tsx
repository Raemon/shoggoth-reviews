'use client';

import { useMemo } from 'react';
import { DiffPanes } from './DiffPanes';
import { isImagePath } from './imageFiles';
import { fileTextPath } from './pullPaths';
import type { FileText } from './pullRequests';
import { ReviewThreadProvider } from './reviewThreadStore';
import { wholeFileSet } from './wholeFileEntry';
import { useGithubToken, useStoreReady } from '@/features/sources/sourceStore';
import { useCachedJson } from '@/features/sources/useCachedJson';
import { PaneStatusLine } from '@/features/surface-ui/PaneStatusLine';

export function RepoFileReader({
  owner,
  repo,
  refName,
  path,
}: {
  owner: string;
  repo: string;
  refName: string;
  path: string;
}) {
  const ready = useStoreReady();
  const token = useGithubToken();
  const wantsText = !isImagePath(path);
  const route = wantsText ? fileTextPath(owner, repo, refName, path) : null;
  const { data, error, reload } = useCachedJson<FileText>(route, token, ready);
  const fileSet = useMemo(() => readableFileSet(refName, path, wantsText, data), [refName, path, wantsText, data]);

  if (error) return <PaneStatusLine tone="error" className="flex-1" onRetry={reload}>{error}</PaneStatusLine>;
  if (wantsText && data?.text === null) return <PaneStatusLine tone="dim" className="flex-1">File too large to show.</PaneStatusLine>;
  return (
    <ReviewThreadProvider owner={owner} repo={repo} number={null}>
      <DiffPanes owner={owner} repo={repo} fileSet={fileSet} files={fileSet?.files ?? []} selected={path} />
    </ReviewThreadProvider>
  );
}

function readableFileSet(refName: string, path: string, wantsText: boolean, data: FileText | null) {
  if (!wantsText) return wholeFileSet(refName, path, null);
  return data?.text == null ? null : wholeFileSet(refName, path, data.text);
}
