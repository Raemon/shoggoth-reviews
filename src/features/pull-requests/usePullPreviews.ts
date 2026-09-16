'use client';

import { useEffect, useRef, useState } from 'react';
import type { FreshPreviewBranch } from './freshPreviewBranch';
import type { PreviewState } from './previewDeployment';
import type { PreviewEntry, PullPreviews } from './pullPreviews';
import { freshPreviewPath, pullPreviewsPath } from './pullPaths';
import { apiPost } from '@/features/sources/apiClient';
import { errorMessage } from '@/features/sources/errorMessage';
import type { RepoRef } from '@/features/sources/parseRepoLink';
import { useGithubToken, useStoreReady } from '@/features/sources/sourceStore';
import { useCachedJson } from '@/features/sources/useCachedJson';

const POLL_MS = 15_000;
const MAX_POLLS = 40;

export interface PreviewControls {
  loaded: boolean;
  headSha: string | null;
  entries: PreviewEntry[];
  best: PreviewEntry | null;
  upToDate: boolean;
  headState: PreviewState;
  awaiting: string | null;
  creating: boolean;
  working: boolean;
  failure: string | null;
  refresh: () => void;
}

export function usePullPreviews(repo: RepoRef, number: number): PreviewControls {
  const ready = useStoreReady();
  const token = useGithubToken();
  const held = useCachedJson<PullPreviews>(pullPreviewsPath(repo.owner, repo.name, number), token, ready);
  const [awaiting, setAwaiting] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const view = summarize(held.data, awaiting);

  const giveUp = () => {
    if (awaiting !== null) setNotice('the preview branch has not deployed yet');
    setAwaiting(null);
  };
  usePollWhileUnsettled({ reload: held.reload, active: ready && view.unsettled, subject: awaiting, giveUp });

  const refresh = () => {
    setNotice(null);
    setCreating(true);
    createFreshPreview(repo, number, token, setAwaiting, held.reload)
      .catch((issue: unknown) => setNotice(`preview refused: ${errorMessage(issue)}`))
      .finally(() => setCreating(false));
  };

  const awaitingSha = view.awaitingBuild ? awaiting : null;
  return {
    ...view,
    loaded: held.data !== null,
    entries: held.data?.entries ?? [],
    awaiting: awaitingSha,
    creating,
    working: creating || awaitingSha !== null,
    failure: notice ?? deployFailure(view.awaited) ?? held.error,
    refresh,
  };
}

export function previewNeedsRebuild(previews: PreviewControls): boolean {
  return previews.loaded && !previews.working && !previews.upToDate && previews.headState !== 'building';
}

export function buildProgress(previews: PreviewControls): string | null {
  if (previews.creating) return 'Creating a fresh preview branch…';
  if (previews.awaiting !== null) return 'Waiting for the fresh preview branch to deploy…';
  return null;
}

export function isCommitEntry(entry: PreviewEntry): boolean {
  return entry.branch === null;
}

export function commitsBehind(previews: PreviewControls): number | null {
  if (previews.best === null) return null;
  const shown = previews.best.forSha;
  const behind = previews.entries.filter(isCommitEntry).findIndex((entry) => entry.sha === shown);
  return behind > 0 ? behind : null;
}

function createFreshPreview(
  repo: RepoRef,
  number: number,
  token: string | null,
  setAwaiting: (sha: string) => void,
  reload: () => Promise<unknown>,
): Promise<unknown> {
  return apiPost<FreshPreviewBranch>(freshPreviewPath(repo.owner, repo.name, number), token)
    .then((made) => setAwaiting(made.sha))
    .then(() => reload().catch(() => {}));
}

function deployFailure(awaited: PreviewEntry | null): string | null {
  if (awaited?.state !== 'failed') return null;
  return `${awaited.branch ?? 'the preview branch'} failed to deploy`;
}

interface PreviewView {
  headSha: string | null;
  best: PreviewEntry | null;
  upToDate: boolean;
  headState: PreviewState;
  awaited: PreviewEntry | null;
  awaitingBuild: boolean;
  unsettled: boolean;
}

const EMPTY_VIEW: PreviewView = {
  headSha: null,
  best: null,
  upToDate: false,
  headState: 'none',
  awaited: null,
  awaitingBuild: false,
  unsettled: false,
};

function summarize(data: PullPreviews | null, awaiting: string | null): PreviewView {
  if (data === null) return EMPTY_VIEW;
  const head = headSummary(data);
  const awaited = data.entries.find((entry) => entry.sha === awaiting) ?? null;
  const awaitingBuild = awaiting !== null && !(awaited !== null && settled(awaited));
  return { ...head, headSha: data.headSha, awaited, awaitingBuild, unsettled: headPending(head.headState, data.entries) || awaitingBuild };
}

function headSummary(data: PullPreviews): Pick<PreviewView, 'best' | 'upToDate' | 'headState'> {
  const forHead = data.entries.filter((entry) => entry.forSha === data.headSha);
  const headReady = forHead.find(isReady) ?? null;
  const best = headReady ?? data.entries.find(isReady) ?? null;
  return { best, upToDate: headReady !== null, headState: headReady ? 'ready' : stateAmong(forHead) };
}

function isReady(entry: PreviewEntry): boolean {
  return entry.state === 'ready';
}

function settled(entry: PreviewEntry): boolean {
  return entry.state === 'ready' || entry.state === 'failed';
}

function stateAmong(entries: PreviewEntry[]): PreviewState {
  if (entries.some((entry) => entry.state === 'building')) return 'building';
  if (entries.some((entry) => entry.state === 'failed')) return 'failed';
  return 'none';
}

function headPending(state: PreviewState, entries: PreviewEntry[]): boolean {
  if (state === 'building') return true;
  return state === 'none' && entries.some((entry) => entry.state !== 'none');
}

interface Poll {
  reload: () => Promise<unknown>;
  active: boolean;
  subject: string | null;
  giveUp: () => void;
}

function usePollWhileUnsettled(poll: Poll): void {
  const latest = useRef(poll);
  latest.current = poll;
  useEffect(() => {
    if (!poll.active) return;
    let polls = 0;
    const timer = setInterval(() => {
      polls += 1;
      if (polls > MAX_POLLS) return stop();
      if (document.visibilityState === 'visible') void latest.current.reload().catch(() => {});
    }, POLL_MS);
    const stop = () => {
      clearInterval(timer);
      latest.current.giveUp();
    };
    return () => clearInterval(timer);
  }, [poll.active, poll.subject]);
}
