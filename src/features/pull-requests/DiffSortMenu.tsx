'use client';

import { setDiffSort, useDiffSort, type DiffSort } from './diffSortStore';
import { iconButtonClass } from '@/features/surface-ui/buttonStyles';
import { HoverCardTrigger } from '@/features/surface-ui/HoverCard';
import { PopoverMenu, type PopoverTrigger } from '@/features/surface-ui/PopoverMenu';
import { SortIcon } from './diffToolbarIcons';

const CHOICES: { sort: DiffSort; label: string }[] = [
  { sort: 'folder', label: 'path' },
  { sort: 'comments', label: 'inline comments, then path' },
  { sort: 'diff', label: 'non-import lines changed' },
  { sort: 'diffAll', label: 'all lines changed' },
];

export function DiffSortMenu() {
  const current = useDiffSort();
  return (
    <PopoverMenu align="right-0" panelClass="w-52 py-1" trigger={(state) => <SortButton current={current} {...state} />}>
      {(close) => CHOICES.map((choice) => <SortChoice key={choice.sort} {...choice} current={current} close={close} />)}
    </PopoverMenu>
  );
}

function SortButton({ current, open, toggle }: PopoverTrigger & { current: DiffSort }) {
  const held = CHOICES.find((choice) => choice.sort === current) ?? CHOICES[0]!;
  const label = `Sort files by ${held.label}`;
  return (
    <HoverCardTrigger label={label} className="mr-1" focusable={false} tooltipStyle placement="top-end">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={toggle}
        className={iconButtonClass(open)}
      >
        <SortIcon />
      </button>
    </HoverCardTrigger>
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
