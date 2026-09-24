import type { ReactNode } from 'react';

const LABEL = 'text-[10px] uppercase tracking-[0.18em] text-ink-dim';

export function PageHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <>
      <p className={`mb-1 ${LABEL}`}>{eyebrow}</p>
      <h1 className="text-xl text-accent">{title}</h1>
    </>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className={`mb-1 mt-5 ${LABEL}`}>{children}</p>;
}
