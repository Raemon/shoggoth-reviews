'use client';

import { fileTextPath } from './pullPaths';
import type { FileText } from './pullRequests';
import { useGithubToken, useStoreReady } from '@/features/sources/sourceStore';
import { useCachedJson } from '@/features/sources/useCachedJson';

export function useFileText(owner: string, repo: string, ref: string, path: string) {
  return useCachedJson<FileText>(fileTextPath(owner, repo, ref, path), useGithubToken(), useStoreReady());
}
