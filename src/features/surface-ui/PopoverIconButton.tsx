'use client';

import type { ReactNode } from 'react';
import { iconButtonClass } from './buttonStyles';
import { HoverCardTrigger, type TipPlacement } from './HoverCard';
import type { PopoverTrigger } from './PopoverMenu';

export function PopoverIconButton({
  label,
  open,
  toggle,
  active = open,
  popup = 'menu',
  placement,
  children,
}: PopoverTrigger & {
  label: string;
  active?: boolean;
  popup?: 'menu' | 'dialog';
  placement?: TipPlacement;
  children: ReactNode;
}) {
  return (
    <HoverCardTrigger label={label} focusable={false} tooltipStyle placement={placement}>
      <button
        type="button"
        aria-haspopup={popup}
        aria-expanded={open}
        aria-label={label}
        onClick={toggle}
        className={iconButtonClass(active)}
      >
        {children}
      </button>
    </HoverCardTrigger>
  );
}
