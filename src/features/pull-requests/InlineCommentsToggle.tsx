'use client';

import { setInlineCommentsExpanded, useInlineCommentsExpanded } from './inlineCommentsStore';
import { smallChoiceClass } from '@/features/surface-ui/buttonStyles';
import { HoverCardTrigger } from '@/features/surface-ui/HoverCard';

export function InlineCommentsToggle() {
  const expanded = useInlineCommentsExpanded();
  const label = expanded ? 'Collapse inline comments' : 'Expand inline comments';
  return (
    <HoverCardTrigger label={label} focusable={false} tooltipStyle placement="top-end">
      <button
        type="button"
        aria-pressed={expanded}
        aria-label={label}
        onClick={() => setInlineCommentsExpanded(!expanded)}
        className={`${smallChoiceClass('mr-1 shrink-0')} ${expanded ? 'text-accent' : ''}`}
      >
        inline
      </button>
    </HoverCardTrigger>
  );
}
