'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { parseOwnerInput, parseRepoLink } from './parseRepoLink';
import { SourceCard } from './SourceCard';
import { repoRoute } from '@/features/codebases/repoPaths';
import { addSource } from './sourceStore';
import { DesktopSignIn } from '@/features/desktop/DesktopSignIn';
import type { GithubAccess } from '@/features/github-auth/githubAccess';
import { FORM_ACTION } from '@/features/surface-ui/buttonStyles';
import { FieldForm } from '@/features/surface-ui/FieldForm';

export function SourceControls({
  compact = false,
  oauthConfigured,
  desktop = false,
}: {
  compact?: boolean;
  oauthConfigured: boolean;
  desktop?: boolean;
}) {
  const router = useRouter();
  const [repoError, setRepoError] = useState<string | null>(null);
  const [ownerError, setOwnerError] = useState<string | null>(null);

  const submitRepo = (link: string) => {
    const parsed = parseRepoLink(link);
    if (!parsed.ok) {
      setRepoError(parsed.error);
      return;
    }
    setRepoError(null);
    addSource({ kind: 'repo', ...parsed.value });
    router.push(repoRoute(parsed.value.owner, parsed.value.name));
  };

  const submitOwner = (login: string, form: HTMLFormElement) => {
    const parsed = parseOwnerInput(login);
    if (!parsed.ok) {
      setOwnerError(parsed.error);
      return;
    }
    setOwnerError(null);
    addSource({ kind: 'owner', login: parsed.value });
    form.reset();
  };

  return (
    <div className={compact ? 'mt-5 flex flex-col gap-2' : 'mt-5 flex flex-col gap-3'}>
      <SourceCard compact={compact} title="A single repository" error={repoError}>
        <FieldForm name="repo" label="Repository link" placeholder="https://github.com/owner/repo" action="Add" onValue={submitRepo} />
      </SourceCard>
      <SourceCard
        compact={compact}
        title="Every public repository of a user or organization"
        note="A GitHub login — either a person or an organization."
        error={ownerError}
      >
        <FieldForm name="owner" label="GitHub login" placeholder="LessWrong2" action="Add" onValue={submitOwner} />
      </SourceCard>
      {desktop ? <DesktopSignIn compact={compact} /> : <OauthCards compact={compact} oauthConfigured={oauthConfigured} />}
    </div>
  );
}

function OauthCards({ compact, oauthConfigured }: { compact: boolean; oauthConfigured: boolean }) {
  return (
    <>
      <SourceCard
        compact={compact}
        title="Only the public repositories you can see on GitHub"
        note={
          oauthConfigured
            ? 'Asks GitHub for access to public repositories only; your private repositories stay out of reposcope.'
            : 'Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to enable this.'
        }
      >
        <ConnectButton oauthConfigured={oauthConfigured} access="public" label="Connect GitHub (public only)" />
      </SourceCard>
      <SourceCard
        compact={compact}
        title="Everything you can see on GitHub, public and private"
        note={
          oauthConfigured
            ? 'Opens GitHub\u2019s authorization page; reposcope asks for read access to your repositories and keeps the token only in your browser\u2019s localStorage.'
            : 'Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to enable this.'
        }
      >
        <ConnectButton oauthConfigured={oauthConfigured} access="all" label="Connect GitHub" />
      </SourceCard>
    </>
  );
}

function ConnectButton({
  oauthConfigured,
  access,
  label,
}: {
  oauthConfigured: boolean;
  access: GithubAccess;
  label: string;
}) {
  if (!oauthConfigured) {
    return (
      <button type="button" disabled className={`${FORM_ACTION} cursor-not-allowed`}>
        {label}
      </button>
    );
  }
  return (
    <a href={`/api/github/connect?access=${access}`} className={`${FORM_ACTION} inline-block`}>
      {label}
    </a>
  );
}
