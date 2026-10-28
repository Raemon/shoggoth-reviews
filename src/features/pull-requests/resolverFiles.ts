'use client';

import { useMemo, useRef } from 'react';
import { ParsedFile, type ResolverFiles } from './definitionResolver';
import { memoPromise } from './promiseMemo';
import { fileTextPath, repoFilesAtRefPath } from './pullPaths';
import type { FileText } from './pullRequests';
import type { RepoFileSet } from './repoFiles';
import { LARGE_FILE_BYTES } from './sizeLimits';
import { parseSource } from './treeSitter';
import { apiJson } from '@/features/sources/apiClient';
import { useGithubToken } from '@/features/sources/sourceStore';

const MAX_PARSED_FILES = 48;

interface RefListing {
  names: Set<string>;
  truncated: boolean;
}

export interface TrimmableFiles extends ResolverFiles {
  tracked<T>(work: Promise<T>): Promise<T>;
  trimParsed(): void;
  preloadable(ref: string, path: string): Promise<boolean>;
}

export function useResolverFiles(owner: string, repo: string): TrimmableFiles {
  const token = useGithubToken();
  const tokenRef = useRef(token);
  tokenRef.current = token;
  return useMemo(() => makeResolverFiles(owner, repo, tokenRef), [owner, repo]);
}

function makeResolverFiles(owner: string, repo: string, token: { current: string | null }): TrimmableFiles {
  const texts = new Map<string, Promise<string | null>>();
  const smallTexts = new Map<string, Promise<boolean | null>>();
  const listings = new Map<string, Promise<RefListing | null>>();
  const fetchText = (ref: string, path: string, maxBytes?: number) =>
    apiJson<FileText>(fileTextPath(owner, repo, ref, path, maxBytes), token.current);
  const readFile = (ref: string, path: string) => once(texts, `${ref}\0${path}`, () => fetchText(ref, path).then((got) => got.text));
  const preloadable = (ref: string, path: string) =>
    fitsPreload(texts, smallTexts, `${ref}\0${path}`, () => fetchText(ref, path, LARGE_FILE_BYTES));
  const listFiles = (ref: string) =>
    once(listings, ref, () =>
      apiJson<RepoFileSet>(repoFilesAtRefPath(owner, repo, ref), token.current).then((got) => ({
        names: new Set(got.files),
        truncated: got.truncated,
      })),
    );
  const hasFile = async (ref: string, path: string) => {
    const listing = await listFiles(ref);
    if (listing?.names.has(path)) return true;
    if (listing && !listing.truncated) return false;
    return (await readFile(ref, path)) !== null;
  };
  return { readFile, hasFile, preloadable, ...parsedFiles(readFile) };
}

// Capped, so preloading never downloads a big file; a small one seeds the text cache.
async function fitsPreload(
  texts: Map<string, Promise<string | null>>,
  smallTexts: Map<string, Promise<boolean | null>>,
  key: string,
  readCapped: () => Promise<FileText>,
): Promise<boolean> {
  const held = texts.get(key);
  if (held) return isSmallText(await held);
  const small = await once(smallTexts, key, async () => {
    const got = await readCapped();
    if (got.text !== null && !texts.has(key)) texts.set(key, Promise.resolve(got.text));
    return got.text !== null;
  });
  return small === true;
}

function isSmallText(text: string | null): boolean {
  return text !== null && text.length <= LARGE_FILE_BYTES;
}

function parsedFiles(readFile: (ref: string, path: string) => Promise<string | null>) {
  const trees = new Map<string, Promise<ParsedFile | null>>();
  let inFlight = 0;
  const parsed = (ref: string, path: string) =>
    once(trees, `${ref}\0${path}`, async () => {
      const text = await readFile(ref, path);
      const tree = text === null ? null : await parseSource(text, path);
      return tree ? new ParsedFile(tree) : null;
    });
  const tracked = <T,>(work: Promise<T>): Promise<T> => {
    inFlight += 1;
    return work.finally(() => (inFlight -= 1));
  };
  const trimParsed = () => {
    if (inFlight === 0 && trees.size >= MAX_PARSED_FILES) evictOldest(trees, MAX_PARSED_FILES / 2);
  };
  return { parsed, tracked, trimParsed };
}

function evictOldest(trees: Map<string, Promise<ParsedFile | null>>, count: number) {
  for (const [key, held] of [...trees].slice(0, count)) {
    void held.then((file) => file?.delete());
    trees.delete(key);
  }
}

function once<T>(held: Map<string, Promise<T | null>>, key: string, work: () => Promise<T | null>): Promise<T | null> {
  return memoPromise(held, key, () =>
    work().catch(() => {
      held.delete(key);
      return null;
    }),
  );
}
