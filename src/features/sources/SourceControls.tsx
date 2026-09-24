'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { parseOwnerInput, parseRepoLink } from './parseRepoLink';
import { SourceCard } from './SourceCard';
import { repoRoute } from '@/features/codebases/repoPaths';
import { addSource } from './sourceStore';
import { DesktopSignIn } from '@/features/desktop/DesktopSignIn';
import type { GithubAccess } from '@/features/github-auth/githubAccess';
import { CHOICE } from '@/features/surface-ui/buttonStyles';
import { MONO_FIELD } from '@/features/surface-ui/fieldStyles';

const FIELD = `${MONO_FIELD} min-w-0 flex-1`;
const ADD = `${CHOICE} shrink-0 active:bg-btn-active`;

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

  const submitRepo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parseRepoLink(String(new FormData(event.currentTarget).get('repo') ?? ''));
    if (!parsed.ok) {
      setRepoError(parsed.error);
      return;
    }
    setRepoError(null);
    addSource({ kind: 'repo', ...parsed.value });
    router.push(repoRoute(parsed.value.owner, parsed.value.name));
  };

  const submitOwner = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const parsed = parseOwnerInput(String(new FormData(form).get('owner') ?? ''));
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
        <form onSubmit={submitRepo} className="flex gap-2">
          <input name="repo" placeholder="https://github.com/owner/repo" aria-label="Repository link" className={FIELD} />
          <button type="submit" className={ADD}>
            Add
          </button>
        </form>
      </SourceCard>
      <SourceCard
        compact={compact}
        title="Every public repository of a user or organization"
        note="A GitHub login — either a person or an organization."
        error={ownerError}
      >
        <form onSubmit={submitOwner} className="flex gap-2">
          <input name="owner" placeholder="LessWrong2" aria-label="GitHub login" className={FIELD} />
          <button type="submit" className={ADD}>
            Add
          </button>
        </form>
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
      <button type="button" disabled className={`${ADD} cursor-not-allowed`}>
        {label}
      </button>
    );
  }
  return (
    <a href={`/api/github/connect?access=${access}`} className={`${ADD} inline-block`}>
      {label}
    </a>
  );
}
