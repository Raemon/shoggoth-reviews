'use client';

import { useState } from 'react';
import { apiJson, apiPost } from '@/features/sources/apiClient';
import { errorMessage } from '@/features/sources/errorMessage';
import { SourceCard } from '@/features/sources/SourceCard';
import { addSource, disconnectGithub, useGithubToken, writeGithubSession } from '@/features/sources/sourceStore';
import { FORM_ACTION } from '@/features/surface-ui/buttonStyles';
import { FieldForm } from '@/features/surface-ui/FieldForm';

const NOTE = 'The token stays on this computer, in reposcope’s own storage, and is sent only to GitHub.';

export function DesktopSignIn({ compact }: { compact: boolean }) {
  const token = useGithubToken();
  const { busy, error, signIn, setError } = useTokenSignIn();
  if (token) return <SignedIn compact={compact} />;
  const pasteToken = (pasted: string) => {
    if (pasted) signIn(() => Promise.resolve(pasted));
    else setError('Paste a token first');
  };
  return (
    <SourceCard compact={compact} title="Sign in to GitHub" note={NOTE} error={error}>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => signIn(githubCliToken)} disabled={busy} className={`${FORM_ACTION} self-start`}>
          Use the GitHub CLI’s sign-in
        </button>
        <FieldForm
          name="token"
          type="password"
          label="Personal access token"
          placeholder="Personal access token"
          action="Sign in"
          disabled={busy}
          onValue={pasteToken}
        />
      </div>
    </SourceCard>
  );
}

function useTokenSignIn() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signIn = (find: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    find()
      .then(adoptToken)
      .catch((issue: unknown) => setError(errorMessage(issue)))
      .finally(() => setBusy(false));
  };
  return { busy, error, signIn, setError };
}

function SignedIn({ compact }: { compact: boolean }) {
  return (
    <SourceCard compact={compact} title="Signed in to GitHub">
      <button type="button" onClick={disconnectGithub} className={FORM_ACTION}>
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
