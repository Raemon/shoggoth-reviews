'use client';

import { usePathname } from 'next/navigation';
import { dismissGithubSignOut, useGithubSignedOut } from './sourceStore';
import { useDesktopBridge } from '@/features/desktop/desktopBridge';
import { connectHref } from '@/features/github-auth/returnPath';

export function GithubSignedOutNotice({ className = '' }: { className?: string }) {
  const signedOut = useGithubSignedOut();
  const desktop = useDesktopBridge() !== null;
  const here = usePathname();
  if (signedOut === null) return null;
  return (
    <span className={`flex shrink-0 items-center gap-1.5 text-[10px] text-error-ink ${className}`}>
      {signedOut.reason}
      <a href={desktop ? '/' : connectHref(signedOut.access, here)} className="underline hover:text-ink">
        reconnect
      </a>
      <button type="button" onClick={dismissGithubSignOut} aria-label="Dismiss GitHub sign-in notice" className="hover:text-ink">
        ×
      </button>
    </span>
  );
}
