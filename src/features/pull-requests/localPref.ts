'use client';

import { useSyncExternalStore } from 'react';

export interface LocalPref<T> {
  fallback: T;
  read(): T;
  set(next: T): void;
  subscribe(listener: () => void): () => void;
}

export function localPref<T>(key: string, fallback: T, decode: (stored: unknown) => T | undefined): LocalPref<T> {
  const listeners = new Set<() => void>();
  // caching by raw keeps read() referentially stable; useSyncExternalStore loops otherwise
  let cached: { raw: string; value: T } | null = null;
  return {
    fallback,
    read() {
      const raw = readItem(key);
      if (raw === null) return fallback;
      if (cached?.raw !== raw) cached = { raw, value: decode(parseRaw(raw)) ?? fallback };
      return cached.value;
    },
    set(next: T) {
      writeItem(key, JSON.stringify(next));
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      window.addEventListener('storage', listener);
      return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', listener);
      };
    },
  };
}

export function enumPref<T extends string>(key: string, values: readonly T[], fallback: T): LocalPref<T> {
  return localPref<T>(key, fallback, (stored) => (values.includes(stored as T) ? (stored as T) : undefined));
}

export function boolPref(key: string, fallback: boolean): LocalPref<boolean> {
  return localPref<boolean>(key, fallback, (stored) => (typeof stored === 'boolean' ? stored : undefined));
}

export function clampedPref<T>(key: string, fallback: T, clamp: (value: number) => number): LocalPref<number | T> {
  return localPref<number | T>(key, fallback, (stored) => {
    const value = finiteNumber(stored);
    return value === undefined ? undefined : clamp(value);
  });
}

export function recordPref<T>(key: string, decodeEntry: (value: unknown) => T | undefined): LocalPref<Partial<Record<string, T>>> {
  return localPref(key, {}, (stored) => decodeRecord(stored, decodeEntry));
}

export function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function decodeRecord<T>(stored: unknown, decodeEntry: (value: unknown) => T | undefined): Record<string, T> | undefined {
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return undefined;
  const record: Record<string, T> = {};
  for (const [name, value] of Object.entries(stored)) {
    const entry = decodeEntry(value);
    if (entry !== undefined) record[name] = entry;
  }
  return record;
}

export function memoryPref<T>(initial: T): LocalPref<T> {
  const listeners = new Set<() => void>();
  let value = initial;
  return {
    fallback: initial,
    read: () => value,
    set(next: T) {
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function usePref<T>(pref: LocalPref<T>): T {
  return useSyncExternalStore(pref.subscribe, pref.read, () => pref.fallback);
}

function parseRaw(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw; // pre-JSON prefs stored bare strings; dropping this resets them
  }
}

function readItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}
