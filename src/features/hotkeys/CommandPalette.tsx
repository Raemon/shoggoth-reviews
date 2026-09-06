'use client';

import { useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useCommands, type Command } from './commandStore';
import { HotkeyCap } from './HotkeyCap';
import { ARROW_STEPS } from '@/features/surface-ui/focusables';
import { FilterField } from '@/features/surface-ui/FilterField';
import { ModalShell } from '@/features/surface-ui/ModalShell';

const ROW = 'flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] leading-4';

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const commands = useCommands();
  const matches = matchingCommands(commands, query);
  const cursor = usePaletteCursor(matches.length);
  const run = (command: Command) => {
    onClose();
    command.run();
  };
  const onKey = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    const step = ARROW_STEPS[event.key];
    const chosen = matches[cursor.index];
    if (step !== undefined) {
      event.preventDefault();
      cursor.step(step);
    } else if (event.key === 'Enter' && chosen) run(chosen);
  };
  const filter = (next: string) => {
    setQuery(next);
    cursor.reset();
  };
  return (
    <ModalShell label="Commands" dismissable onDismiss={onClose}>
      <FilterField value={query} onChange={filter} onKeyDown={onKey} placeholder="Type a command…" aria-label="Filter commands" className="mt-2 w-full" />
      <CommandList matches={matches} cursorIndex={cursor.index} onHover={cursor.set} onRun={run} />
      <p className="mt-2 text-[9px] uppercase tracking-[0.18em] text-ink-dim">↑↓ move · ⏎ run · esc close</p>
    </ModalShell>
  );
}

function usePaletteCursor(count: number) {
  const [held, setHeld] = useState(0);
  const index = Math.min(held, Math.max(0, count - 1));
  return {
    index,
    set: setHeld,
    reset: () => setHeld(0),
    step: (delta: number) => setHeld(wrapIndex(index + delta, count)),
  };
}

function CommandList({
  matches,
  cursorIndex,
  onHover,
  onRun,
}: {
  matches: Command[];
  cursorIndex: number;
  onHover: (index: number) => void;
  onRun: (command: Command) => void;
}) {
  return (
    <ul className="mt-2 max-h-[50vh] overflow-auto" role="listbox">
      {matches.map((command, index) => (
        <CommandRow key={command.id} command={command} current={index === cursorIndex} onHover={() => onHover(index)} onRun={() => onRun(command)} />
      ))}
      {matches.length === 0 && <li className="px-2 py-1 text-[11px] text-ink-dim">No matching commands.</li>}
    </ul>
  );
}

function CommandRow({ command, current, onHover, onRun }: { command: Command; current: boolean; onHover: () => void; onRun: () => void }) {
  return (
    <li role="option" aria-selected={current}>
      <button
        type="button"
        onPointerEnter={onHover}
        onClick={onRun}
        className={`${ROW} ${current ? 'bg-btn-active text-accent' : 'text-ink hover:bg-btn-hover'}`}
      >
        <span className="min-w-0 flex-1 truncate">{command.label}</span>
        {command.keys.map((key) => (
          <HotkeyCap key={key} hotkey={key} />
        ))}
      </button>
    </li>
  );
}

function matchingCommands(commands: Command[], query: string): Command[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return commands;
  return commands.filter((command) => command.label.toLowerCase().includes(needle) || command.keys.includes(needle));
}

function wrapIndex(index: number, count: number): number {
  return count === 0 ? 0 : (index + count) % count;
}
