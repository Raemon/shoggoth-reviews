'use client';

import { useEffect, useState } from 'react';
import { splitLines } from './expandDiff';
import { fileTextPath } from './pullPaths';
import type { ChangedFile, FileText } from './pullRequests';
import { LARGE_FILE_BYTES } from './sizeLimits';
import { apiJson } from '@/features/sources/apiClient';
import { useGithubToken } from '@/features/sources/sourceStore';
import { errorMessage } from '@/features/sources/errorMessage';

const TWO_SIDED = new Set(['modified', 'renamed', 'copied', 'changed', 'unchanged']);

/** 'auto' skips files over LARGE_FILE_BYTES; 'full' is an explicit click. */
export type WholeFileWish = 'none' | 'auto' | 'full';

type Lines = { base: string[]; head: string[] };

export interface WholeFile {
  available: boolean;
  loading: boolean;
  error: string | null;
  large: boolean;
  lines: Lines | null;
}

export function hunkHint(wholeFile: WholeFile, expanded: boolean): string {
  if (!wholeFile.available) return '';
  if (wholeFile.error) return wholeFile.error;
  if (wholeFile.loading) return 'loading whole file…';
  if (wholeFile.large) return 'large file — click to show whole file';
  return expanded ? 'whole file — click to show changed lines only' : 'click to show whole file';
}

export function useWholeFile(
  owner: string,
  repo: string,
  file: ChangedFile,
  baseRef: string,
  headRef: string,
  wish: WholeFileWish,
): WholeFile {
  const token = useGithubToken();
  const identity = `${baseRef}\0${headRef}\0${file.previousFilename ?? file.filename}\0${file.filename}`;
  const [held, setHeld] = useState<{ identity: string; lines: Lines | null } | null>(null);
  const [failure, setFailure] = useState<{ identity: string; message: string } | null>(null);
  const available = TWO_SIDED.has(file.status);
  const wanted = wish !== 'none';
  const maxBytes = wish === 'auto' ? LARGE_FILE_BYTES : undefined;
  const loaded = held?.identity === identity ? held : null;
  const lines = loaded?.lines ?? null;
  const large = wish === 'auto' && loaded !== null && lines === null;
  const error = failure?.identity === identity ? failure.message : null;

  useEffect(() => {
    if (!wanted || !available) return;
    const controller = new AbortController();
    loadBothSides(owner, repo, identity, token, controller.signal, maxBytes)
      .then((got) => {
        if (!controller.signal.aborted) setHeld((was) => keptLines(was, identity, got));
      })
      .catch((issue: unknown) => {
        if (controller.signal.aborted) return;
        setFailure({ identity, message: errorMessage(issue) });
      });
    return () => controller.abort();
  }, [wanted, available, identity, owner, repo, token, maxBytes]);

  return { available, loading: wanted && !lines && !error && !large, error, large, lines: wanted ? lines : null };
}

// A capped reload of a file already open in full must not close it again.
function keptLines(was: { identity: string; lines: Lines | null } | null, identity: string, loaded: Lines | null) {
  return loaded === null && was?.identity === identity && was.lines ? was : { identity, lines: loaded };
}

/** Null when a side is over maxBytes, which only a capped request sets. */
async function loadBothSides(
  owner: string,
  repo: string,
  identity: string,
  token: string | null,
  signal: AbortSignal,
  maxBytes: number | undefined,
): Promise<Lines | null> {
  const [baseRef, headRef, basePath, headPath] = identity.split('\0');
  const [base, head] = await Promise.all([
    readText(owner, repo, baseRef ?? '', basePath ?? '', token, signal, maxBytes),
    readText(owner, repo, headRef ?? '', headPath ?? '', token, signal, maxBytes),
  ]);
  if (base.text === null || head.text === null) {
    if (maxBytes !== undefined) return null;
    throw new Error('file too large to expand');
  }
  return { base: splitLines(base.text), head: splitLines(head.text) };
}

function readText(
  owner: string,
  repo: string,
  ref: string,
  path: string,
  token: string | null,
  signal: AbortSignal,
  maxBytes: number | undefined,
): Promise<FileText> {
  return apiJson<FileText>(fileTextPath(owner, repo, ref, path, maxBytes), token, signal);
}
