'use client';

import { useMemo } from 'react';
import { DiffPanes } from './DiffPanes';
import type { EditTargetValue } from './editTarget';
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
  // A commit moves refName; without this the open editor unmounts while the new text loads.
  const text = useLastKnown(data, path);
  const fileSet = useMemo(() => readableFileSet(refName, path, wantsText, text), [refName, path, wantsText, text]);
  const edits = reloadFiles ? defaultBranchEdits(() => showCommitted(reloadFiles, owner, repo, path, token)) : null;

  if (error) return <PaneStatusLine tone="error" className="flex-1" onRetry={reload}>{error}</PaneStatusLine>;
  if (wantsText && text?.text === null) return <PaneStatusLine tone="dim" className="flex-1">File too large to show.</PaneStatusLine>;
  return (
    <ReviewThreadProvider owner={owner} repo={repo} number={null}>
      <DiffPanes owner={owner} repo={repo} fileSet={fileSet} files={fileSet?.files ?? []} selected={path} sortable={false} edits={edits} />
    </ReviewThreadProvider>
  );
}

function readableFileSet(refName: string, path: string, wantsText: boolean, data: FileText | null) {
  if (!wantsText) return wholeFileSet(refName, path, null);
  return data?.text == null ? null : wholeFileSet(refName, path, data.text);
}

function defaultBranchEdits(onCommitted: () => Promise<void>): Omit<EditTargetValue, 'headRef'> {
  return { pull: null, onCommitted };
}

async function showCommitted(
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
