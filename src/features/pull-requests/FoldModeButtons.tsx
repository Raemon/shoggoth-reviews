'use client';

import { Fragment, type ReactNode } from 'react';
import { applyFoldMode, useFoldCommand, type FoldMode } from './foldModeStore';
import { ChoiceButton } from '@/features/surface-ui/ChoiceButton';
import {
  CollapseAllFilesIcon,
  CollapseExceptCommentsIcon,
  CollapseExceptTypesIcon,
  CollapseHidingCommentsIcon,
  ExpandAllFilesIcon,
  ExpandAllIcon,
  GitHubIcon,
  SmartFoldIcon,
} from './diffToolbarIcons';

const CHOICES: { mode: FoldMode; icon: ReactNode; label: string }[] = [
  { mode: 'default', icon: <SmartFoldIcon />, label: 'Default folding — whole file, with unchanged blocks and fully deleted files collapsed' },
  { mode: 'expandAll', icon: <ExpandAllIcon />, label: 'Expand all code sections' },
  { mode: 'collapseExceptTypes', icon: <CollapseExceptTypesIcon />, label: 'Collapse everything except types and interfaces' },
  { mode: 'collapseHidingComments', icon: <CollapseHidingCommentsIcon />, label: 'Collapse everything, and hide the comments directly above each collapsed section' },
  { mode: 'collapseExceptComments', icon: <CollapseExceptCommentsIcon />, label: 'Collapse everything except comments' },
  { mode: 'gitDefault', icon: <GitHubIcon />, label: 'GitHub default — the diff hunks exactly as GitHub shows them, with nothing folded' },
];

export function FoldModeButtons({ filesOpen, onToggleAllFiles }: { filesOpen: boolean; onToggleAllFiles: () => void }) {
  const command = useFoldCommand();
  return (
    <span className="flex items-center gap-2">
      {CHOICES.map(({ mode, icon, label }) => (
        <Fragment key={mode}>
          {mode === 'gitDefault' && <AllFilesToggle filesOpen={filesOpen} onToggle={onToggleAllFiles} />}
          <ChoiceButton label={label} active={command.mode === mode} placement="top-start" onSelect={() => applyFoldMode(mode)}>
            {icon}
          </ChoiceButton>
        </Fragment>
      ))}
    </span>
  );
}

function AllFilesToggle({ filesOpen, onToggle }: { filesOpen: boolean; onToggle: () => void }) {
  return (
    <ChoiceButton
      label={filesOpen ? 'Collapse all files' : 'Expand all files'}
      active={false}
      placement="top-start"
      onSelect={onToggle}
    >
      {filesOpen ? <CollapseAllFilesIcon /> : <ExpandAllFilesIcon />}
    </ChoiceButton>
  );
}
