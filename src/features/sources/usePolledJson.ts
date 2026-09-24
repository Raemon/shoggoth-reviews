'use client';

import { useStoreReady } from './sourceStore';
import { useCachedJson, type CachedJson } from './useCachedJson';
import { usePollWhileVisible } from './usePollWhileVisible';

export function usePolledJson<T>(path: string | null, token: string | null): CachedJson<T> {
  const ready = useStoreReady();
  const state = useCachedJson<T>(path, token, ready);
  usePollWhileVisible(state.reload, ready && path !== null);
  return state;
}
