'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { localTitle, titleFor } from './documentTitles';
import { pullBeingRead, repoBeingRead } from './repoPaths';
import { useCurrentLocal } from '@/features/local-git/currentLocalStore';
import { useCurrentPull } from '@/features/pull-requests/currentPullStore';

export function DocumentTitle() {
  const pathname = usePathname();
  const repo = repoBeingRead(pathname);
  const loaded = useCurrentPull(repo?.owner ?? '', repo?.name ?? '', pullBeingRead(pathname) ?? 0);
  const local = useCurrentLocal();
  const title = local ? localTitle(local) : titleFor(pathname, loaded?.pull.title ?? null);
  useEffect(() => {
    document.title = title;
  }, [title]);
  return null;
}
