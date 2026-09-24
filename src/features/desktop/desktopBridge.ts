'use client';

import { useSyncExternalStore } from 'react';
import type { SavedSettings } from '@/features/settings/settings';

// Exposed by desktop/preload.cjs; absent in a browser.
export interface DesktopBridge {
  chooseRepository(): Promise<string | null>;
  settings: unknown;
  saveSettings(settings: SavedSettings): Promise<void>;
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
