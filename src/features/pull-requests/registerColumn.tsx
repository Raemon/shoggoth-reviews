'use client';

import { useLayoutEffect } from 'react';
import { usePaneMode } from './centralLayout';
import { COLUMN_COMMANDS } from './columnCommands';
import { useNavRegistry } from './columnNav';
import type { ColumnId, NavColumn } from './navColumn';
import { useCommand } from '@/features/hotkeys/commandStore';

export function useRegisterColumn(id: ColumnId, column: NavColumn, available = true) {
  const { register, toggle } = useNavRegistry();
  const visible = available && usePaneMode(id) !== 'hidden';
  useLayoutEffect(() => {
    if (!visible) return;
    register(id, column);
    return () => register(id, null);
  });
  useCommand(available ? COLUMN_COMMANDS[id] ?? null : null, () => toggle(id));
}
