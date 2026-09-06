import type { CommandSpec } from '@/features/hotkeys/commandStore';
import type { ColumnId } from './navColumn';

export const COLUMN_COMMANDS: Partial<Record<ColumnId, CommandSpec>> = {
  pulls: { id: 'column:pulls', label: 'pull requests column', keys: ['1', 'p'] },
  discussion: { id: 'column:discussion', label: 'discussion column', keys: ['2', 'd'] },
  commits: { id: 'column:commits', label: 'commits column', keys: ['3', 'c'] },
  files: { id: 'column:files', label: 'files column', keys: ['4', 'f'] },
  'ai-chat': { id: 'column:ai-chat', label: 'ai chat column', keys: ['5', 'a'] },
};

export function columnHotkeyHint(id: ColumnId): string | null {
  const keys = COLUMN_COMMANDS[id]?.keys;
  return keys === undefined ? null : keys.join(' / ').toUpperCase();
}
