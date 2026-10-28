'use client';

import { usePathname } from 'next/navigation';
import { useGithubAccess, useGithubToken } from './sourceStore';
import { useDesktopBridge } from '@/features/desktop/desktopBridge';
import { connectHref } from '@/features/github-auth/returnPath';
import { FORM_ACTION } from '@/features/surface-ui/buttonStyles';

const NOT_SIGNED_IN = 'If this repository is private, connect a GitHub account that can see it.';
const PUBLIC_ONLY = 'Your GitHub connection covers public repositories only. If this one is private, reconnect with private access.';

// GitHub answers 404, not 403, for private repositories the caller can't see.
export function GithubAccessHint({ errorStatus, className = '' }: { errorStatus: number | null; className?: string }) {
  const token = useGithubToken();
  const access = useGithubAccess();
  const here = usePathname();
  const desktop = useDesktopBridge() !== null;
  if (errorStatus !== 404 || (token !== null && access === 'all')) return null;
  return (
    <div className={`flex flex-col items-start gap-2 text-[11px] leading-4 text-ink ${className}`}>
      <p>{token === null ? NOT_SIGNED_IN : PUBLIC_ONLY}</p>
      <a href={desktop ? '/' : connectHref('all', here)} className={FORM_ACTION}>
        {token === null ? 'Connect GitHub' : 'Reconnect GitHub'}
      </a>
    </div>
  );
}
