'use client';

import { useEffect, useState } from 'react';
import type { RepoSummary, ViewerRepos } from './repoDirectory';
import { repoSummaryPath } from '@/features/pull-requests/pullPaths';
import type { SourceResult } from './sidebarGroups';
import type { GithubAccess } from '@/features/github-auth/githubAccess';
import { apiJson } from '@/features/sources/apiClient';
import { readBrowserCache, writeBrowserCache } from '@/features/sources/browserCache';
import { sourceKey, type CodebaseSource } from '@/features/sources/sourceTypes';
import { errorMessage } from '@/features/sources/errorMessage';

const NONE = new Map<string, SourceResult>();
const inFlight = new Map<string, Promise<SourceResult>>();

export function useSourceResults(
  sources: CodebaseSource[],
  token: string | null,
  ready: boolean,
  access: GithubAccess,
): Map<string, SourceResult> {
  const [results, setResults] = useState({ token, map: NONE });

  useEffect(() => {
    if (!ready) return;
    let live = true;
    const remember = (key: string, result: SourceResult) => {
      if (!live) return;
      setResults((held) => {
        const map = held.token === token ? held.map : NONE;
        return sameResult(map.get(key), result) ? held : { token, map: new Map(map).set(key, result) };
      });
    };
    for (const source of sources) {
      const cached = readBrowserCache<SourceResult>(cacheName(source, token, access));
      if (cached) remember(sourceKey(source), cached);
      void requestSource(source, token, access, cached).then((result) => remember(sourceKey(source), result));
    }
    return () => {
      live = false;
    };
  }, [sources, token, ready, access]);

  return results.token === token ? results.map : NONE;
}

function requestSource(
  source: CodebaseSource,
  token: string | null,
  access: GithubAccess,
  cached: SourceResult | null,
): Promise<SourceResult> {
  const name = cacheName(source, token, access);
  const running = inFlight.get(name);
  if (running) return running;
  const request = fetchSource(source, token, access)
    .then((result) => {
      writeBrowserCache(name, result);
      return result;
    })
    .catch(
      (error: unknown): SourceResult =>
        cached ?? { state: 'error', message: errorMessage(error) },
    )
    .finally(() => inFlight.delete(name));
  inFlight.set(name, request);
  return request;
}

function cacheName(source: CodebaseSource, token: string | null, access: GithubAccess): string {
  return `source ${token ? `signed-in ${access}` : 'anonymous'} ${sourceKey(source)}`;
}

function sameResult(held: SourceResult | undefined, next: SourceResult): boolean {
  return held !== undefined && JSON.stringify(held) === JSON.stringify(next);
}

function fetchSource(source: CodebaseSource, token: string | null, access: GithubAccess): Promise<SourceResult> {
  switch (source.kind) {
    case 'owner':
      return apiJson<RepoSummary[]>(`/api/github/repos?owner=${encodeURIComponent(source.login)}`, token).then(
        (repos) => ({ state: 'ready', repos, login: null }),
      );
    case 'repo':
      return apiJson<RepoSummary>(repoSummaryPath(source.owner, source.name), token).then((repo) => ({
        state: 'ready',
        repos: [repo],
        login: null,
      }));
    case 'viewer':
      return apiJson<ViewerRepos>(`/api/github/viewer?access=${access}`, token).then((viewer) => ({
        state: 'ready',
        repos: viewer.repos,
        login: viewer.login,
      }));
  }
}
