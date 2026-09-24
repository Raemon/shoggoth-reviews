'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useDesktopBridge, type DesktopBridge } from './desktopBridge';
import { forgetRepo, useRecentRepos } from './recentRepos';
import { localRepoRoute, repoName } from '@/features/local-git/localRoutes';
import { SourceCard } from '@/features/sources/SourceCard';
import { FORM_ACTION } from '@/features/surface-ui/buttonStyles';
import { FieldForm } from '@/features/surface-ui/FieldForm';

export function LocalRepositories() {
  const router = useRouter();
  const bridge = useDesktopBridge();
  const [error, setError] = useState<string | null>(null);
  const openPath = (path: string) => {
    const absolute = path.startsWith('/');
    setError(absolute ? null : 'Enter an absolute path, like /Users/you/project');
    if (absolute) router.push(localRepoRoute(path));
  };
  return (
    <SourceCard compact={false} title="A repository on this computer" error={error}>
      <div className="flex gap-2">
        {bridge && <ChooseFolderButton bridge={bridge} onChosen={openPath} />}
        <FieldForm name="path" label="Repository path" placeholder="/path/to/repository" action="Open" onValue={openPath} />
      </div>
      <RecentRepos />
    </SourceCard>
  );
}

function ChooseFolderButton({ bridge, onChosen }: { bridge: DesktopBridge; onChosen: (path: string) => void }) {
  const choose = async () => {
    const path = await bridge.chooseRepository();
    if (path) onChosen(path);
  };
  return (
    <button type="button" onClick={() => void choose()} className={FORM_ACTION}>
      Choose folder…
    </button>
  );
}

function RecentRepos() {
  const recents = useRecentRepos();
  if (recents.length === 0) return null;
  return (
    <ul className="mt-3">
      {recents.map((repo) => (
        <li key={repo} className="group flex items-baseline gap-2 border-t border-panel-edge py-1 text-[11px] leading-4">
          <Link href={localRepoRoute(repo)} className="flex min-w-0 flex-1 items-baseline gap-2 text-ink hover:text-accent">
            <span className="shrink-0">{repoName(repo)}</span>
            <span className="min-w-0 truncate text-[10px] text-ink-dim">{repo}</span>
          </Link>
          <button
            type="button"
            onClick={() => forgetRepo(repo)}
            aria-label={`Forget ${repo}`}
            className="text-ink-dim opacity-0 hover:text-error-ink focus-visible:opacity-100 group-hover:opacity-100"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}
