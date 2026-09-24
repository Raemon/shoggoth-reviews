'use client';

import type { ReactNode } from 'react';

export function SourceCard({
  compact,
  title,
  note,
  error,
  children,
}: {
  compact: boolean;
  title: string;
  note?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <section className={`rounded bg-panel ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
      <h2 className={compact ? 'text-[11px] text-ink' : 'text-xs text-ink'}>{title}</h2>
      <div className="mt-2">{children}</div>
      {error && <p className="mt-1.5 text-[10px] leading-4 text-error-ink">{error}</p>}
      {note && <p className="mt-2 text-[10px] leading-4 text-ink-dim">{note}</p>}
    </section>
  );
}
