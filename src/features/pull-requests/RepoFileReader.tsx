'use client';

import { useMemo } from 'react';
import { DiffPanes } from './DiffPanes';
import { isImagePath } from './imageFiles';
import { fileTextPath } from './pullPaths';
import type { FileText } from './pullRequests';
import type { RepoFileSet } from './repoFiles';
import { ReviewThreadProvider } from './reviewThreadStore';
import { wholeFileSet } from './wholeFileEntry';
import { useGithubToken, useStoreReady } from '@/features/sources/sourceStore';
import { requestJson, useCachedJson } from '@/features/sources/useCachedJson';
import { PaneStatusLine } from '@/features/surface-ui/PaneStatusLine';
import { useLastKnown } from '@/features/surface-ui/useLastKnown';

export function RepoFileReader({
  owner,
  repo,
  refName,
  path,
  reloadFiles,
}: {
  owner: string;
  repo: string;
  refName: string;
  path: string;
  reloadFiles?: () => Promise<RepoFileSet>;
}) {
  const ready = useStoreReady();
  const token = useGithubToken();
  const wantsText = !isImagePath(path);
  const route = wantsText ? fileTextPath(owner, repo, refName, path) : null;
  const { data, error, reload } = useCachedJson<FileText>(route, token, ready);
  // Keeps the editor mounted while text for the post-commit refName loads.
  const text = useLastKnown(data, path);
  const fileSet = useMemo(() => readableFileSet(refName, path, wantsText, text), [refName, path, wantsText, text]);
  const onCommitted = reloadFiles && (() => refreshAfterCommit(reloadFiles, owner, repo, path, token));

  if (error) return <PaneStatusLine tone="error" className="flex-1" onRetry={reload}>{error}</PaneStatusLine>;
  if (wantsText && text?.text === null) return <PaneStatusLine tone="dim" className="flex-1">File too large to show.</PaneStatusLine>;
  return (
    <ReviewThreadProvider owner={owner} repo={repo} number={null}>
      <DiffPanes
        owner={owner}
        repo={repo}
        fileSet={fileSet}
        files={fileSet?.files ?? []}
        selected={path}
        sortable={false}
        editSource={onCommitted && { pull: null, onCommitted }}
      />
    </ReviewThreadProvider>
  );
}

function readableFileSet(refName: string, path: string, wantsText: boolean, data: FileText | null) {
  if (!wantsText) return wholeFileSet(refName, path, null);
  return data?.text == null ? null : wholeFileSet(refName, path, data.text);
}

async function refreshAfterCommit(
  reloadFiles: () => Promise<RepoFileSet>,
  owner: string,
  repo: string,
  path: string,
  token: string | null,
): Promise<void> {
  try {
    const next = await reloadFiles();
    await requestJson<FileText>(fileTextPath(owner, repo, next.sha, path), token);
  } catch {
    // The commit landed; a failed refresh only leaves the old text showing.
  }
}
