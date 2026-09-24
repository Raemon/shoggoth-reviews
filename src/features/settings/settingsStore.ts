'use client';

import { useSyncExternalStore } from 'react';
import { readItem } from '@/features/pull-requests/localPref';
import { DEFAULT_SETTINGS, LEGACY_THEME_KEY, parseSettings, SETTINGS_COOKIE, type SavedSettings, type Settings, type ThemeSetting } from './settings';

const COOKIE_PREFIX = `${SETTINGS_COOKIE}=`;
const COOKIE_MAX_AGE = 400 * 24 * 60 * 60;
const listeners = new Set<() => void>();
let saved: SavedSettings | null = null;
let otherWindows: BroadcastChannel | null = null;

export function useSetting<K extends keyof Settings>(name: K): Settings[K] {
  return useSyncExternalStore(subscribe, () => readSetting(name), () => DEFAULT_SETTINGS[name]);
}

export function setSetting<K extends keyof Settings>(name: K, value: Settings[K]): void {
  const next = { ...readSaved(), [name]: value };
  adopt(next);
  persist(next);
  otherWindows?.postMessage(next);
}

export function followOtherWindows(): () => void {
  const channel = new BroadcastChannel(SETTINGS_COOKIE);
  channel.onmessage = (event) => adopt(parseSettings(event.data));
  otherWindows = channel;
  return () => stopFollowing(channel);
}

function stopFollowing(channel: BroadcastChannel): void {
  otherWindows = null;
  channel.close();
}

function readSetting<K extends keyof Settings>(name: K): Settings[K] {
  return readSaved()[name] ?? DEFAULT_SETTINGS[name];
}

function readSaved(): SavedSettings {
  saved ??= { ...legacyTheme(), ...parseSettings(storedSettings()) };
  return saved;
}

function adopt(next: SavedSettings): void {
  saved = next;
  applyTheme(next.theme ?? DEFAULT_SETTINGS.theme);
  for (const listener of listeners) listener();
}

function storedSettings(): unknown {
  const desktop = window.reposcopeDesktop;
  return desktop ? desktop.settings : readCookie();
}

function persist(next: SavedSettings): void {
  const desktop = window.reposcopeDesktop;
  if (desktop) void desktop.saveSettings(next);
  else writeCookie(next);
}

function readCookie(): unknown {
  const cookie = document.cookie.split('; ').find((part) => part.startsWith(COOKIE_PREFIX));
  try {
    return cookie ? JSON.parse(decodeURIComponent(cookie.slice(COOKIE_PREFIX.length))) : null;
  } catch {
    return null;
  }
}

function writeCookie(next: SavedSettings): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  const value = encodeURIComponent(JSON.stringify(next));
  document.cookie = `${COOKIE_PREFIX}${value}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

// The removed header toggle saved themes here; honored until a theme is saved.
function legacyTheme(): SavedSettings {
  return parseSettings({ theme: readItem(LEGACY_THEME_KEY) });
}

// Without data-theme, globals.css follows the system's light or dark preference.
function applyTheme(theme: ThemeSetting): void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
