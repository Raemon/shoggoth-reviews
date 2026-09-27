export const SETTINGS_ROUTE = '/settings';
export const SETTINGS_COOKIE = 'reposcope.settings';
export const LEGACY_THEME_KEY = 'reposcope.theme';

export const THEME_SETTINGS = ['system', 'light', 'dark'] as const;
export const BLANK_LINE_SETTINGS = ['full', 'half', 'extra-small'] as const;
const ON_OFF = [true, false] as const;

export type ThemeSetting = (typeof THEME_SETTINGS)[number];
export type BlankLineSetting = (typeof BLANK_LINE_SETTINGS)[number];

export interface Settings {
  theme: ThemeSetting;
  blankLines: BlankLineSetting;
  semiblankLines: boolean;
}

// Only chosen values are saved, so changed defaults still reach everyone else.
export type SavedSettings = Partial<Settings>;

export const DEFAULT_SETTINGS: Settings = { theme: 'system', blankLines: 'half', semiblankLines: true };

export function parseSettings(stored: unknown): SavedSettings {
  const record = asRecord(stored);
  return {
    ...choice(record, 'theme', THEME_SETTINGS),
    ...choice(record, 'blankLines', BLANK_LINE_SETTINGS),
    ...choice(record, 'semiblankLines', ON_OFF),
  };
}

function asRecord(stored: unknown): Record<string, unknown> {
  return typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>) : {};
}

function choice<K extends keyof Settings>(record: Record<string, unknown>, name: K, values: readonly Settings[K][]): SavedSettings {
  const value = record[name] as Settings[K];
  return values.includes(value) ? { [name]: value } : {};
}
