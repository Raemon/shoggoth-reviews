'use client';

import { useSyncExternalStore } from 'react';

// Exposed by desktop/preload.cjs; absent in a browser.
export interface DesktopBridge {
  chooseRepository(): Promise<string | null>;
}

declare global {
  interface Window {
    reposcopeDesktop?: DesktopBridge;
  }
}

export function useDesktopBridge(): DesktopBridge | null {
  return useSyncExternalStore(
    () => () => {},
    () => window.reposcopeDesktop ?? null,
    () => null,
  );
}
