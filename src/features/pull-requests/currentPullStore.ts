'use client';

import { useSyncExternalStore } from 'react';
import type { CommitSummary, PullRequestCommits } from './pullRequests';

export interface CurrentPull {
  owner: string;
  repo: string;
  pull: PullRequestCommits;
  reload: () => Promise<unknown>;
}

export interface CurrentBranch {
  owner: string;
  repo: string;
  branch: string;
  head: CommitSummary | null;
}

export function subjectStore<T>() {
  let current: T | null = null;
  const listeners = new Set<() => void>();
  return {
    set(next: T | null): void {
      current = next;
      listeners.forEach((notify) => notify());
    },
    read: () => current,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const pulls = subjectStore<CurrentPull>();
const branches = subjectStore<CurrentBranch>();
const nothingHeld = () => null;

export function setCurrentPull(next: CurrentPull | null): void {
  pulls.set(next);
}

export function setCurrentBranch(next: CurrentBranch | null): void {
  branches.set(next);
}

export function reloadCurrentPull(): Promise<unknown> {
  return pulls.read()?.reload() ?? Promise.resolve();
}

export function useCurrentPull(owner: string, repo: string, number: number): PullRequestCommits | null {
  const held = useSyncExternalStore(pulls.subscribe, pulls.read, nothingHeld);
  return held && held.owner === owner && held.repo === repo && held.pull.pull.number === number ? held.pull : null;
}

export function useCurrentBranchHead(owner: string, repo: string, branch: string): CommitSummary | null {
  const held = useSyncExternalStore(branches.subscribe, branches.read, nothingHeld);
  return held && held.owner === owner && held.repo === repo && held.branch === branch ? held.head : null;
}
