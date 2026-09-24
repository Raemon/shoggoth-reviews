'use client';

import { GithubSignedOutNotice } from './GithubSignedOutNotice';
import { SectionLabel } from './PageHeading';
import { SourceControls } from './SourceControls';
import { useGithubAccess, useGithubToken, useSources, useStoreReady } from './sourceStore';
import { CodebaseList } from '@/features/codebases/CodebaseList';
import { sidebarGroups } from '@/features/codebases/sidebarGroups';
import { useSourceResults } from '@/features/codebases/useSourceResults';

export function useOnboarding(): boolean {
  const ready = useStoreReady();
  const sources = useSources();
  return !ready || sources.length === 0;
}

export function GithubSources({ oauthConfigured, desktop = false }: { oauthConfigured: boolean; desktop?: boolean }) {
  const onboarding = useOnboarding();
  return (
    <>
      <GithubSignedOutNotice className="mt-3 rounded bg-error-bg px-3 py-2 !text-xs" />
      {!onboarding && <YourCodebases />}
      <SourceControls compact={!onboarding} oauthConfigured={oauthConfigured} desktop={desktop} />
    </>
  );
}

function YourCodebases() {
  const sources = useSources();
  const results = useSourceResults(sources, useGithubToken(), true, useGithubAccess());
  return (
    <>
      <SectionLabel>Your codebases</SectionLabel>
      <div className="flex max-h-[26rem] flex-col overflow-hidden rounded bg-panel">
        <CodebaseList groups={sidebarGroups(sources, results)} />
      </div>
      <SectionLabel>Add more</SectionLabel>
    </>
  );
}
