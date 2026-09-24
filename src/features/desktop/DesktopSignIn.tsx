'use client';

import { useState, type FormEvent } from 'react';
import { apiJson, apiPost } from '@/features/sources/apiClient';
import { errorMessage } from '@/features/sources/errorMessage';
import { SourceCard } from '@/features/sources/SourceCard';
import { addSource, disconnectGithub, useGithubToken, writeGithubSession } from '@/features/sources/sourceStore';
import { CHOICE } from '@/features/surface-ui/buttonStyles';
import { MONO_FIELD } from '@/features/surface-ui/fieldStyles';

const ACTION = `${CHOICE} shrink-0 active:bg-btn-active`;
const NOTE = 'The token stays on this computer, in reposcope’s own storage, and is sent only to GitHub.';

export function DesktopSignIn({ compact }: { compact: boolean }) {
  const token = useGithubToken();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (token) return <SignedIn compact={compact} />;

  const signIn = (find: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    find()
      .then(adoptToken)
      .catch((issue: unknown) => setError(errorMessage(issue)))
      .finally(() => setBusy(false));
  };
  const submitToken = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const pasted = String(new FormData(event.currentTarget).get('token') ?? '').trim();
    signIn(() => (pasted ? Promise.resolve(pasted) : Promise.reject(new Error('Paste a token first'))));
  };

  return (
    <SourceCard compact={compact} title="Sign in to GitHub" note={NOTE} error={error}>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => signIn(githubCliToken)} disabled={busy} className={`${ACTION} self-start`}>
          Use the GitHub CLI’s sign-in
        </button>
        <form onSubmit={submitToken} className="flex gap-2">
          <input name="token" type="password" placeholder="Personal access token" aria-label="Personal access token" className={`${MONO_FIELD} min-w-0 flex-1`} />
          <button type="submit" disabled={busy} className={ACTION}>
            Sign in
          </button>
        </form>
      </div>
    </SourceCard>
  );
}

function SignedIn({ compact }: { compact: boolean }) {
  return (
    <SourceCard compact={compact} title="Signed in to GitHub">
      <button type="button" onClick={disconnectGithub} className={ACTION}>
        Sign out
      </button>
    </SourceCard>
  );
}

async function githubCliToken(): Promise<string> {
  return (await apiPost<{ token: string }>('/api/local/gh-token', null)).token;
}

async function adoptToken(token: string): Promise<void> {
  await apiJson<{ login: string }>('/api/github/me', token);
  writeGithubSession({ token, access: 'all', refreshToken: null, expiresAt: null, refreshExpiresAt: null });
  addSource({ kind: 'viewer' });
}
