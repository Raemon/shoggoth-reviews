'use client';

import { LocalRepositories } from './LocalRepositories';
import { GithubSources } from '@/features/sources/GithubSources';
import { LandingError } from '@/features/sources/Landing';
import { PageHeading, SectionLabel } from '@/features/sources/PageHeading';

export function DesktopHome({ error }: { error: string | null }) {
  return (
    <section className="max-w-2xl">
      <PageHeading eyebrow="Choose what to read" title="reposcope" />
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
