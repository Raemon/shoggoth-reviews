'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { iconButtonClass } from './buttonStyles';
import { HoverCardTrigger } from './HoverCard';

const iconActionClass = (active: boolean) => `${iconButtonClass(active)} hover:bg-btn-hover`;

export function IconToggleButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <IconTip label={label}>
      <button type="button" onClick={onClick} aria-label={label} className={iconActionClass(false)}>
        {children}
      </button>
    </IconTip>
  );
}

export function IconLink({ label, href, active, children }: { label: string; href: string; active: boolean; children: ReactNode }) {
  return (
    <IconTip label={label}>
      <Link href={href} aria-label={label} className={iconActionClass(active)}>
        {children}
      </Link>
    </IconTip>
  );
}

function IconTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <HoverCardTrigger label={label} className="shrink-0" focusable={false} tooltipStyle>
      {children}
    </HoverCardTrigger>
  );
}
