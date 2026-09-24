'use client';

import { GithubSources, useOnboarding } from './GithubSources';

export function Landing({ error, oauthConfigured }: { error: string | null; oauthConfigured: boolean }) {
  const onboarding = useOnboarding();
  return (
    <section className="max-w-2xl">
      <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-ink-dim">
        {onboarding ? 'Choose what to read' : 'Read straight from GitHub'}
      </p>
      <h1 className="text-xl text-accent">reposcope</h1>
      <p className="mt-2 text-xs leading-5 text-ink-dim">
        {onboarding ? 'Point reposcope at GitHub repositories. ' : 'Pick a repository below to read it. '}
        Each one lists its open pull requests, read straight from GitHub: the discussion, the commits, and the diff
        side by side.
      </p>
      <LandingError error={error} />
      <GithubSources oauthConfigured={oauthConfigured} />
    </section>
  );
}

export function LandingError({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="mt-3 rounded bg-error-bg px-3 py-2 text-xs text-error-ink">{error}</p>;
}
