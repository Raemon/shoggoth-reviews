'use client';

import { useLayoutEffect } from 'react';
import { useCentralLayout, usePaneMode } from './centralLayout';
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
  useColumnCommand(id, available, toggle);
}

function useColumnCommand(id: ColumnId, available: boolean, toggle: (id: ColumnId) => void) {
  const { central, chatOpen, setChatOpen } = useCentralLayout();
  useCommand(available ? COLUMN_COMMANDS[id] ?? null : null, () => {
    if (central && id === 'ai-chat') setChatOpen(!chatOpen);
    toggle(id);
  });
}
