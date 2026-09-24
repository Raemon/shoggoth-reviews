'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useDesktopBridge } from './desktopBridge';
import { forgetRepo, useRecentRepos } from './recentRepos';
import { localRepoRoute, repoName } from '@/features/local-git/localRoutes';
import { CHOICE } from '@/features/surface-ui/buttonStyles';
import { MONO_FIELD } from '@/features/surface-ui/fieldStyles';

const ACTION = `${CHOICE} shrink-0 active:bg-btn-active`;

export function LocalRepositories() {
  const router = useRouter();
  const bridge = useDesktopBridge();
  const [error, setError] = useState<string | null>(null);
  const choose = async () => {
    const path = await bridge?.chooseRepository();
    if (path) router.push(localRepoRoute(path));
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const path = String(new FormData(event.currentTarget).get('path') ?? '').trim();
    setError(path.startsWith('/') ? null : 'Enter an absolute path, like /Users/you/project');
    if (path.startsWith('/')) router.push(localRepoRoute(path));
  };
  return (
    <section className="rounded bg-panel px-4 py-3">
      <div className="flex gap-2">
        {bridge && (
          <button type="button" onClick={() => void choose()} className={ACTION}>
            Choose folder…
          </button>
        )}
        <form onSubmit={submit} className="flex min-w-0 flex-1 gap-2">
          <input name="path" placeholder="/path/to/repository" aria-label="Repository path" className={`${MONO_FIELD} min-w-0 flex-1`} />
          <button type="submit" className={ACTION}>
            Open
          </button>
        </form>
      </div>
      {error && <p className="mt-1.5 text-[10px] leading-4 text-error-ink">{error}</p>}
      <RecentRepos />
    </section>
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
