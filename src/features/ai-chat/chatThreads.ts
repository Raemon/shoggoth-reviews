'use client';

import { useMemo } from 'react';
import type { CursorAgent } from './cursorTypes';
import { localPref, usePref } from '@/features/pull-requests/localPref';

export type ThreadPurpose = 'chat' | 'merge-conflicts';

export interface ThreadTarget {
  subject: string;
  owner: string;
  repo: string;
  number: number | null;
  headRef: string;
  headSha: string | null;
}

export interface ChatThread extends ThreadTarget {
  key: string;
  model: string | null;
  purpose: ThreadPurpose;
  agentId: string | null;
  agentUrl: string | null;
  runId: string | null;
  createdAt: string;
}

const LIMIT = 200;
const NAME_PREFIX = 'Human in the Loop';
const PURPOSE_WORDS: Record<ThreadPurpose, string> = { chat: 'chat', 'merge-conflicts': 'merge conflicts' };

const threadsPref = localPref<ChatThread[]>('reposcope.aiThreads', [], decodeThreads);

export function readThreads(): ChatThread[] {
  return threadsPref.read();
}

export function subscribeThreads(listener: () => void): () => void {
  return threadsPref.subscribe(listener);
}

export function useSubjectThreads(subject: string): ChatThread[] {
  const threads = usePref(threadsPref);
  return useMemo(() => threadsFor(threads, subject), [threads, subject]);
}

export function latestThreadFor(subject: string): ChatThread | null {
  const held = threadsFor(readThreads(), subject);
  return held[held.length - 1] ?? null;
}

export function rememberThread(thread: ChatThread): void {
  const others = readThreads().filter((held) => held.key !== thread.key && !sameAgent(held, thread));
  threadsPref.set([...others, thread].sort(byCreation).slice(-LIMIT));
}

export function updateThread(key: string, change: Partial<ChatThread>): void {
  const held = readThreads().find((thread) => thread.key === key);
  if (held) rememberThread({ ...held, ...change });
}

export function forgetThread(key: string): void {
  threadsPref.set(readThreads().filter((thread) => thread.key !== key));
}

export function newThreadKey(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `t${Date.now()}${Math.random().toString(36).slice(2)}`;
}

export function threadName(thread: ChatThread): string {
  return `${NAME_PREFIX} · ${thread.subject}${shaSuffix(thread)} · ${PURPOSE_WORDS[thread.purpose]}`;
}

export function threadLabel(thread: ChatThread, index: number): string {
  return `${index + 1} · ${PURPOSE_WORDS[thread.purpose]}${shaSuffix(thread)}`;
}

export function adoptCursorAgents(agents: CursorAgent[], target: ThreadTarget): void {
  const known = new Set(readThreads().map((thread) => thread.agentId));
  for (const agent of agents) {
    if (!known.has(agent.id) && agent.latestRunId) rememberThread({ ...target, ...threadFromAgent(agent) });
  }
}

function threadFromAgent(agent: CursorAgent): Omit<ChatThread, keyof ThreadTarget> {
  const name = agent.name ?? '';
  return {
    key: agent.id,
    model: null,
    purpose: purposeFromName(name),
    agentId: agent.id,
    agentUrl: agent.url ?? null,
    runId: agent.latestRunId ?? null,
    createdAt: agent.createdAt ?? new Date(0).toISOString(),
  };
}

function purposeFromName(name: string): ThreadPurpose {
  return name.includes(PURPOSE_WORDS['merge-conflicts']) ? 'merge-conflicts' : 'chat';
}

function threadsFor(threads: ChatThread[], subject: string): ChatThread[] {
  return threads.filter((thread) => thread.subject === subject);
}

function shaSuffix(thread: ChatThread): string {
  return thread.headSha === null ? '' : ` @${thread.headSha.slice(0, 7)}`;
}

function sameAgent(a: ChatThread, b: ChatThread): boolean {
  return a.agentId !== null && a.agentId === b.agentId;
}

function byCreation(a: ChatThread, b: ChatThread): number {
  return a.createdAt.localeCompare(b.createdAt);
}

function decodeThreads(stored: unknown): ChatThread[] | undefined {
  return Array.isArray(stored) ? stored.filter(isThread) : undefined;
}

function isThread(value: unknown): value is ChatThread {
  if (typeof value !== 'object' || value === null) return false;
  const held = value as Partial<ChatThread>;
  return typeof held.key === 'string' && typeof held.subject === 'string' && typeof held.createdAt === 'string';
}
