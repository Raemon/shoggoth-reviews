import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const SETTINGS_FILE = join(homedir(), '.reposcope', 'settings.json');

export function readSettingsFile() {
  try {
    return JSON.parse(readFileSync(SETTINGS_FILE, 'utf8'));
  } catch {
    return null;
  }
}

// Synchronous, so two quick saves land in the order they were made.
export function writeSettingsFile(settings) {
  mkdirSync(dirname(SETTINGS_FILE), { recursive: true });
  writeFileSync(SETTINGS_FILE, `${JSON.stringify(settings, null, 2)}\n`);
}
