'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { parseGithubAccess } from '@/features/github-auth/githubAccess';
import { grantFromParams } from '@/features/github-auth/grantParams';
import { returnPath } from '@/features/github-auth/returnPath';
import { sessionFromGrant } from '@/features/sources/githubSession';
import { addSource, writeGithubSession } from '@/features/sources/sourceStore';
import { PaneStatusLine } from '@/features/surface-ui/PaneStatusLine';

export default function ConnectPage() {
  const router = useRouter();
  useEffect(() => {
    const granted = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = granted.get('token');
    if (token) {
      writeGithubSession(sessionFromGrant(grantFromParams(granted, token), parseGithubAccess(granted.get('access'))));
      addSource({ kind: 'viewer' });
    }
    const next = returnPath(granted.get('next')) ?? '/';
    window.history.replaceState(null, '', '/connect');
    router.replace(token ? next : `/?error=${encodeURIComponent('GitHub sign-in returned no token')}`);
  }, [router]);
  return <PaneStatusLine tone="dim" className="m-4">Connecting to GitHub…</PaneStatusLine>;
}
