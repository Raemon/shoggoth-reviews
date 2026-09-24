'use client';

import Link from 'next/link';
import { ChangeCountCells } from './ChangeCounts';
import { AuthorPortrait } from './CommentByline';
import { commitRoute, commitUrl, shortSha } from './pullPaths';
import type { CommitDetail } from './pullRequests';
import { CopyButton } from '@/features/surface-ui/CopyButton';
import { OpenOnGithubLink } from '@/features/surface-ui/OpenOnGithubLink';
import { plural } from '@/features/surface-ui/plural';
import { RelativeTime } from '@/features/surface-ui/RelativeTime';

const META_ROW = 'flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] leading-4 text-ink-dim';
const SHA_LINK = 'text-ink hover:text-accent hover:underline';

export function CommitHeader({ owner, repo, commit }: { owner: string; repo: string; commit: CommitDetail }) {
  const [title, body] = splitMessage(commit.message);
  return (
    <header className="shrink-0 border-b border-panel-edge bg-panel px-3 py-2">
      <div className="flex items-start gap-2">
        <h1 className="min-w-0 flex-1 break-words font-serif text-[18px] leading-[1.25] text-ink">{title}</h1>
        <OpenOnGithubLink href={commitUrl(owner, repo, commit.headRef)} label="this commit" className="text-ink-dim hover:text-accent" />
      </div>
      {body && <pre className="mt-1.5 whitespace-pre-wrap break-words font-mono text-[11px] leading-4 text-ink-dim">{body}</pre>}
      <div className={`${META_ROW} mt-2`}>
        <AuthorPortrait avatarUrl={commit.avatarUrl} className="h-4 w-4" />
        <span className="text-ink">{commit.author}</span>
        <span>committed</span>
        <RelativeTime iso={commit.date} />
        <span className="flex-1" />
        <ParentLinks owner={owner} repo={repo} parents={commit.parents} />
        <span>commit</span>
        <CopyButton value={commit.headRef} what="commit hash" ariaLabel={`Copy commit hash ${commit.headRef}`} className="text-ink hover:text-accent">
          {commit.headRef}
        </CopyButton>
      </div>
      <p className={`${META_ROW} mt-1`}>
        Showing {plural(commit.files.length, 'changed file')} with
        <ChangeCountCells additions={commit.additions} deletions={commit.deletions} />
      </p>
    </header>
  );
}

function ParentLinks({ owner, repo, parents }: { owner: string; repo: string; parents: string[] }) {
  if (parents.length === 0) return null;
  return (
    <>
      <span>{plural(parents.length, 'parent')}</span>
      {parents.map((parent) => (
        <Link key={parent} href={commitRoute(owner, repo, parent)} className={SHA_LINK}>
          {shortSha(parent)}
        </Link>
      ))}
    </>
  );
}

function splitMessage(message: string): [string, string] {
  const [title = '', ...rest] = message.split('\n');
  return [title, rest.join('\n').trim()];
}
