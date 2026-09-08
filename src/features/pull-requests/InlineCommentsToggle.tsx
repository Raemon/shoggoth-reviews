'use client';

import { setInlineCommentsExpanded, useInlineCommentsExpanded } from './inlineCommentsStore';
import { ChoiceButton } from '@/features/surface-ui/ChoiceButton';
import { StrokeIcon } from '@/features/surface-ui/StrokeIcon';

export function InlineCommentsToggle() {
  const expanded = useInlineCommentsExpanded();
  return (
    <ChoiceButton
      label={expanded ? 'Collapse inline comments' : 'Expand inline comments'}
      active={expanded}
      placement="top-end"
      onSelect={() => setInlineCommentsExpanded(!expanded)}
    >
      {expanded ? <CollapseInlineIcon /> : <ExpandInlineIcon />}
    </ChoiceButton>
  );
}

function ExpandInlineIcon() {
  return (
    <StrokeIcon>
      <path d="M3.5 4.5h17M3.5 19.5h17" />
      <path d="M8 10 12 6.5 16 10M8 14 12 17.5l4-3.5" />
    </StrokeIcon>
  );
}

function CollapseInlineIcon() {
  return (
    <StrokeIcon>
      <path d="M3.5 4.5h17M3.5 19.5h17" />
      <path d="M8 7.5 12 11 16 7.5M8 16.5 12 13l4 3.5" />
    </StrokeIcon>
  );
}
