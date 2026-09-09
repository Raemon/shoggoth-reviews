'use client';

import { setDiffSort, useDiffSort, type DiffSort } from './diffSortStore';
import { PopoverIconButton } from '@/features/surface-ui/PopoverIconButton';
import { PopoverMenu, type PopoverTrigger } from '@/features/surface-ui/PopoverMenu';
import { SortIcon } from './diffToolbarIcons';

const CHOICES: { sort: DiffSort; label: string }[] = [
  { sort: 'comments', label: 'inline comments' },
  { sort: 'diff', label: 'line-diff, excluding imports' },
  { sort: 'diffAll', label: 'line-diff, all lines' },
  { sort: 'folder', label: 'alphabetical folder' },
];

export function DiffSortMenu() {
  const current = useDiffSort();
  return (
    <PopoverMenu align="right-0" panelClass="w-52 py-1" trigger={(state) => <SortButton current={current} {...state} />}>
      {(close) => CHOICES.map((choice) => <SortChoice key={choice.sort} {...choice} current={current} close={close} />)}
    </PopoverMenu>
  );
}

function SortButton({ current, ...trigger }: PopoverTrigger & { current: DiffSort }) {
  const held = CHOICES.find((choice) => choice.sort === current) ?? CHOICES[0]!;
  return (
    <PopoverIconButton label={`Sort files by ${held.label}`} placement="top-end" {...trigger}>
      <SortIcon />
    </PopoverIconButton>
  );
}

function SortChoice({ sort, label, current, close }: { sort: DiffSort; label: string; current: DiffSort; close: () => void }) {
  const active = sort === current;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => {
        setDiffSort(sort);
        close();
      }}
      className={`block w-full px-2 py-1 text-left text-[11px] leading-4 hover:bg-btn-hover ${active ? 'text-accent' : 'text-ink'}`}
    >
      {label}
    </button>
  );
}
