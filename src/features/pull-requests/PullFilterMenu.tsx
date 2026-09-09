'use client';

import { setPullAuthor, setPullState, useOfferedPullAuthors, usePullFilters } from './pullFilterStore';
import { PopoverIconButton } from '@/features/surface-ui/PopoverIconButton';
import { PopoverMenu, type PopoverTrigger } from '@/features/surface-ui/PopoverMenu';

const FILTER_LABEL = 'Filter pull requests';

export function PullFilterMenu() {
  const filters = usePullFilters();
  const offersMine = useOfferedPullAuthors().includes('mine');
  return (
    <PopoverMenu align="right-0" panelClass="w-44 py-1" trigger={FilterButton}>
      {() => (
        <>
          <FilterCheckbox label="only open PRs" on={filters.state === 'open'} onChange={(on) => setPullState('open', on)} />
          <FilterCheckbox label="only closed PRs" on={filters.state === 'closed'} onChange={(on) => setPullState('closed', on)} />
          {offersMine && (
            <FilterCheckbox
              label="only my PRs"
              on={filters.author === 'mine'}
              onChange={(on) => setPullAuthor(on ? 'mine' : 'anyone')}
            />
          )}
        </>
      )}
    </PopoverMenu>
  );
}

function FilterButton(trigger: PopoverTrigger) {
  return (
    <PopoverIconButton label={FILTER_LABEL} {...trigger}>
      <FilterIcon />
    </PopoverIconButton>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 5h17l-6.5 7.6V20l-4-2.6v-4.8Z" />
    </svg>
  );
}

function FilterCheckbox({ label, on, onChange }: { label: string; on: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 px-2 py-1 text-[11px] leading-4 text-ink hover:bg-btn-hover">
      <input
        type="checkbox"
        checked={on}
        onChange={(event) => onChange(event.target.checked)}
        className="size-3 accent-accent"
      />
      {label}
    </label>
  );
}
