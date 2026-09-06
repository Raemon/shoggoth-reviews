'use client';

import type { ComponentProps } from 'react';

const FILTER_INPUT = 'w-full pl-4 font-mono text-[11px] leading-4 text-ink outline-none placeholder:text-ink-dim';

export function FilterField({
  onChange,
  className = 'w-full',
  ...rest
}: Omit<ComponentProps<'input'>, 'onChange' | 'type'> & { onChange: (next: string) => void }) {
  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <SearchIcon />
      <input type="search" onChange={(event) => onChange(event.target.value)} className={FILTER_INPUT} {...rest} />
    </span>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="pointer-events-none absolute left-0 top-1/2 h-3 w-3 -translate-y-1/2 text-ink-dim"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <circle cx="6.75" cy="6.75" r="4.25" />
      <path d="M10 10l3.5 3.5" />
    </svg>
  );
}
