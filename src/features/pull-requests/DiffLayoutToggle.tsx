'use client';

import { useContext, type ReactNode } from 'react';
import { setDiffLayout, useDiffLayout, type DiffLayout } from './diffLayoutStore';
import { EditTarget } from './editTarget';
import { setDiffEditMode, useDiffEditMode } from './editModeStore';
import { DiffSortMenu } from './DiffSortMenu';
import { FoldModeButtons } from './FoldModeButtons';
import { ChoiceButton } from '@/features/surface-ui/ChoiceButton';
import type { IconButtonTone } from '@/features/surface-ui/buttonStyles';
import {
  CollapseAllFilesIcon,
  EditIcon,
  ExpandAllFilesIcon,
  ResultViewIcon,
  SplitViewIcon,
  UnifiedViewIcon,
  WrapLinesIcon,
} from './diffToolbarIcons';
import { setDiffWrap, useDiffWrap } from './diffWrapStore';

const CHOICES: { layout: DiffLayout; icon: ReactNode; label: string; tone?: IconButtonTone }[] = [
  { layout: 'split', icon: <SplitViewIcon />, label: 'Show diffs in a two-column view' },
  { layout: 'unified', icon: <UnifiedViewIcon />, label: 'Show diffs in a one-column view' },
  { layout: 'result', icon: <ResultViewIcon />, label: 'Show the file as it will be, with removed lines hidden', tone: 'add' },
];

export function DiffLayoutToggle({
  sortable,
  filesOpen,
  onToggleAllFiles,
}: {
  sortable: boolean;
  filesOpen: boolean;
  onToggleAllFiles: () => void;
}) {
  const current = useDiffLayout();
  return (
    <div className="relative z-30 flex shrink-0 items-center gap-2 border-b border-panel-edge bg-panel px-2 py-[2px]">
      <AllFilesToggle filesOpen={filesOpen} onToggle={onToggleAllFiles} />
      <FoldModeButtons />
      <span className="ml-auto flex items-center gap-2">
        {CHOICES.map(({ layout, icon, label, tone }) => (
          <ChoiceButton
            key={layout}
            label={label}
            active={current === layout}
            tone={tone}
            placement="top-end"
            onSelect={() => setDiffLayout(layout)}
          >
            {icon}
          </ChoiceButton>
        ))}
        <WrapToggle />
        <EditModeToggle />
        {sortable && <DiffSortMenu />}
      </span>
    </div>
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

function WrapToggle() {
  const wrap = useDiffWrap();
  return (
    <ChoiceButton
      label="Wrap long lines instead of scrolling them sideways"
      active={wrap}
      placement="top-end"
      onSelect={() => setDiffWrap(!wrap)}
    >
      <WrapLinesIcon />
    </ChoiceButton>
  );
}

function EditModeToggle() {
  const editMode = useDiffEditMode();
  const target = useContext(EditTarget);
  if (!target?.pull) return null;
  return (
    <ChoiceButton
      label="Edit mode — click any line to edit it; triple-click works either way"
      active={editMode}
      placement="top-end"
      onSelect={() => setDiffEditMode(!editMode)}
    >
      <EditIcon />
    </ChoiceButton>
  );
}
