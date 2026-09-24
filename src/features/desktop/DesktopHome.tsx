'use client';

import type { ReactNode } from 'react';
import { LocalRepositories } from './LocalRepositories';
import { GithubSources } from '@/features/sources/GithubSources';
import { LandingError } from '@/features/sources/Landing';

export function DesktopHome({ error }: { error: string | null }) {
  return (
    <section className="max-w-2xl">
      <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-ink-dim">Choose what to read</p>
      <h1 className="text-xl text-accent">reposcope</h1>
      <p className="mt-2 text-xs leading-5 text-ink-dim">
        Open a local repository to review its uncommitted work, its branches and its stashes, or read pull requests
        straight from GitHub.
      </p>
      <LandingError error={error} />
      <SectionLabel>Local repositories</SectionLabel>
      <LocalRepositories />
      <SectionLabel>GitHub</SectionLabel>
      <GithubSources oauthConfigured={false} desktop />
    </section>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-1 mt-5 text-[10px] uppercase tracking-[0.18em] text-ink-dim">{children}</p>;
}
