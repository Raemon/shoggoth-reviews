'use client';

import { StateTags } from './PullListRow';
import { useCurrentBranchHead, useCurrentPull } from './currentPullStore';
import { pullUrl } from './pullPaths';
import { useIsOwnAuthor } from '@/features/github-auth/useViewerLogin';
import type { RepoRef } from '@/features/sources/parseRepoLink';
import { HoverCardTrigger } from '@/features/surface-ui/HoverCard';
import { OpenOnGithubLink } from '@/features/surface-ui/OpenOnGithubLink';
import { RelativeTime } from '@/features/surface-ui/RelativeTime';

const TITLE_ROW = 'flex min-w-0 flex-1 items-baseline gap-2 pl-3 text-[13px] leading-5';
const META_ROW = 'hidden shrink-0 items-baseline gap-1.5 pl-3 text-[10px] text-ink-dim/60 md:flex';
const GITHUB_LINK = 'rounded px-1 text-[10px] leading-4 text-ink-dim/60 hover:text-ink';

export function CurrentPullTitle({ repo, number }: { repo: RepoRef; number: number }) {
  const pull = useCurrentPull(repo.owner, repo.name, number);
  return (
    <div className={TITLE_ROW}>
      <span className="shrink-0 text-accent">#{number}</span>
      {pull && (
        <>
          <TruncatedName text={pull.pull.title} serif className="font-serif text-[17px] leading-6 tracking-[0.005em] text-ink" />
          <StateTags pull={pull.pull} />
          <AuthorAndTime author={pull.pull.author} iso={pull.pull.updatedAt} />
          <OpenOnGithubLink href={pullUrl(repo.owner, repo.name, number)} label="pull request" className={GITHUB_LINK} />
        </>
      )}
    </div>
  );
}

export function CurrentBranchTitle({ repo, branch }: { repo: RepoRef; branch: string }) {
  const head = useCurrentBranchHead(repo.owner, repo.name, branch);
  return (
    <div className={TITLE_ROW}>
      <span aria-hidden className="shrink-0 text-accent">
        ⑂
      </span>
      <TruncatedName text={branch} className="font-mono text-[13px] leading-6 text-ink" />
      {head && <AuthorAndTime author={head.author} iso={head.date} />}
      <OpenOnGithubLink href={`https://github.com/${repo.owner}/${repo.name}/tree/${encodeURI(branch)}`} label="branch" className={GITHUB_LINK} />
    </div>
  );
}

function TruncatedName({ text, className, serif = false }: { text: string; className: string; serif?: boolean }) {
  return (
    <HoverCardTrigger label={text} serifLabel={serif} className="min-w-0" focusable={false} tooltipStyle>
      <span className={`min-w-0 truncate ${className}`}>{text}</span>
    </HoverCardTrigger>
  );
}

function AuthorAndTime({ author, iso }: { author: string; iso: string }) {
  const isOwnAuthor = useIsOwnAuthor();
  return (
    <div className={META_ROW}>
      {!isOwnAuthor(author) && (
        <>
          <span className="text-ink-dim">{author}</span>
          <Dot />
        </>
      )}
      <RelativeTime iso={iso} />
    </div>
  );
}

function Dot() {
  return (
    <span aria-hidden className="text-ink-dim/30">
      ·
    </span>
  );
}
