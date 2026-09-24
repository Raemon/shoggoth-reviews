'use client';

import { useEffect } from 'react';
import { followOtherWindows } from './settingsStore';

export function SettingsSync() {
  useEffect(followOtherWindows, []);
  return null;
}
