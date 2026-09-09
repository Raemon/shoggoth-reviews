'use client';

import type { ReactNode } from 'react';
import {
  applyFoldMode,
  setFoldSearch,
  toggleFoldReveal,
  useFoldCommand,
  type FoldMode,
  type FoldReveal,
} from './foldModeStore';
import { ChoiceButton } from '@/features/surface-ui/ChoiceButton';
import { FilterField } from '@/features/surface-ui/FilterField';
import { PopoverIconButton } from '@/features/surface-ui/PopoverIconButton';
import { PopoverMenu, type PopoverTrigger } from '@/features/surface-ui/PopoverMenu';
import {
  CollapseAllCodeIcon,
  CollapseAllFilesIcon,
  ExpandAllIcon,
  ExpandCommentsIcon,
  ExpandFunctionsIcon,
  ExpandTypesIcon,
  SearchIcon,
  SmartFoldIcon,
} from './diffToolbarIcons';

const MODES: { mode: FoldMode; icon: ReactNode; label: string }[] = [
  { mode: 'default', icon: <SmartFoldIcon />, label: 'Default folding — whole file, with unchanged blocks and fully deleted files collapsed' },
  { mode: 'expandAll', icon: <ExpandAllIcon />, label: 'Expand all code sections' },
  { mode: 'collapseCode', icon: <CollapseAllCodeIcon />, label: 'Collapse every code block, comment group and import run to one line' },
  { mode: 'collapseFiles', icon: <CollapseAllFilesIcon />, label: 'Collapse every file to its header' },
];

const REVEALS: { reveal: FoldReveal; icon: ReactNode; label: string }[] = [
  { reveal: 'comments', icon: <ExpandCommentsIcon />, label: 'Also expand comment blocks' },
  { reveal: 'types', icon: <ExpandTypesIcon />, label: 'Also expand types and interfaces' },
  { reveal: 'functions', icon: <ExpandFunctionsIcon />, label: 'Also expand functions and classes' },
];

const SEARCH_LABEL = 'Also expand blocks containing a search string';

export function FoldModeButtons({ hasDiffs }: { hasDiffs: boolean }) {
  const command = useFoldCommand();
  const shownMode = shownFoldMode(command.mode, hasDiffs);
  return (
    <span className="flex items-center gap-2">
      {MODES.filter(({ mode }) => hasDiffs || mode !== 'default').map(({ mode, icon, label }) => (
        <ChoiceButton key={mode} label={label} active={shownMode === mode} placement="top-start" onSelect={() => applyFoldMode(mode)}>
          {icon}
        </ChoiceButton>
      ))}
      <span aria-hidden className="mx-0.5 h-3.5 w-px bg-panel-edge" />
      {REVEALS.map(({ reveal, icon, label }) => (
        <ChoiceButton key={reveal} label={label} active={command.reveals.has(reveal)} placement="top-start" onSelect={() => toggleFoldReveal(reveal)}>
          {icon}
        </ChoiceButton>
      ))}
      <SearchReveal search={command.search} />
    </span>
  );
}

// With no diff to read, default folding already collapses every block; light that button.
function shownFoldMode(mode: FoldMode, hasDiffs: boolean): FoldMode {
  return mode === 'default' && !hasDiffs ? 'collapseCode' : mode;
}

function SearchReveal({ search }: { search: string }) {
  return (
    <PopoverMenu align="left-0" panelClass="w-60 px-2 py-1" trigger={(state) => <SearchButton active={search !== ''} {...state} />}>
      {(close) => (
        <FilterField
          value={search}
          onChange={setFoldSearch}
          placeholder="expand blocks containing…"
          aria-label={SEARCH_LABEL}
          onKeyDown={(event) => event.key === 'Enter' && close()}
        />
      )}
    </PopoverMenu>
  );
}

function SearchButton({ active, ...trigger }: PopoverTrigger & { active: boolean }) {
  return (
    <PopoverIconButton label={SEARCH_LABEL} active={active || trigger.open} popup="dialog" placement="top-start" {...trigger}>
      <SearchIcon />
    </PopoverIconButton>
  );
}
