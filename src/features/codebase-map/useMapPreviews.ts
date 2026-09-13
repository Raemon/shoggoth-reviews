'use client';

import { useEffect, useState } from 'react';
import { apiJson } from '@/features/sources/apiClient';
import { errorMessage } from '@/features/sources/errorMessage';
import { useGithubToken, useStoreReady } from '@/features/sources/sourceStore';
import type { CodePreview, MapPreviewPage } from './mapPreviewTypes';

interface Previews {
  files: ReadonlyMap<string, CodePreview>;
  loading: boolean;
  error: string | null;
  tooLarge: boolean;
}
const EMPTY: Previews = { files: new Map(), loading: true, error: null, tooLarge: false };

export function useMapPreviews(owner: string, repo: string, sha: string) {
  const token = useGithubToken();
  const ready = useStoreReady();
  const [attempt, setAttempt] = useState(0);
  const [previews, setPreviews] = useState<Previews>(EMPTY);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setPreviews(EMPTY);
    loadPreviews(owner, repo, sha, token, controller.signal, setPreviews).catch((issue) => {
      if (!controller.signal.aborted) setPreviews((held) => ({ ...held, loading: false, error: errorMessage(issue) }));
    });
    return () => controller.abort();
  }, [owner, repo, sha, token, ready, attempt]);
  return { ...previews, retry: () => setAttempt((held) => held + 1) };
}

async function loadPreviews(owner: string, repo: string, sha: string, token: string | null, signal: AbortSignal, publish: (state: Previews) => void) {
  let cursor: number | null = 0;
  const files = new Map<string, CodePreview>();
  while (cursor !== null && !signal.aborted) {
    const page: MapPreviewPage = await apiJson(previewPath(owner, repo, sha, cursor), token, signal);
    if (signal.aborted) return;
    publish(accumulatePage(files, page));
    cursor = page.next;
  }
}

function accumulatePage(files: Map<string, CodePreview>, page: MapPreviewPage): Previews {
  for (const [path, code] of Object.entries(page.files)) files.set(path, code);
  return { files: new Map(files), loading: page.next !== null, error: null, tooLarge: page.tooLarge };
}

function previewPath(owner: string, repo: string, sha: string, cursor: number): string {
  return `/api/github/map-previews?${new URLSearchParams({ owner, repo, sha, cursor: String(cursor) })}`;
}
