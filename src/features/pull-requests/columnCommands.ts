import type { CommandSpec } from '@/features/hotkeys/commandStore';
import type { ColumnId } from './navColumn';

export const COLUMN_COMMANDS: Partial<Record<ColumnId, CommandSpec>> = {
  pulls: { id: 'column:pulls', label: 'pull requests column', keys: ['1'] },
  discussion: { id: 'column:discussion', label: 'discussion column', keys: ['2'] },
  commits: { id: 'column:commits', label: 'commits column', keys: ['3'] },
  files: { id: 'column:files', label: 'files column', keys: ['4'] },
  'ai-chat': { id: 'column:ai-chat', label: 'ai chat column', keys: ['5'] },
};

export function columnHotkeyHint(id: ColumnId): string | undefined {
  return COLUMN_COMMANDS[id]?.keys[0];
}
