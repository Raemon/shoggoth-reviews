'use client';

import Link from 'next/link';
import type { CurrentLocal } from './currentLocalStore';
import { commandLine, localRepoRoute, repoName } from './localRoutes';
import { HoverCardTrigger } from '@/features/surface-ui/HoverCard';

export function LocalHeaderSubject({ local }: { local: CurrentLocal }) {
  return (
    <div className="flex min-w-0 flex-1 items-baseline gap-2 pl-3 text-[13px] leading-5">
      <HoverCardTrigger label={local.repo} className="shrink-0" focusable={false} tooltipStyle>
        <Link href={localRepoRoute(local.repo)} className="text-accent hover:underline">
          {repoName(local.repo)}
        </Link>
      </HoverCardTrigger>
      {local.target && <span className="min-w-0 truncate font-mono text-ink">{commandLine(local.target)}</span>}
    </div>
  );
}
