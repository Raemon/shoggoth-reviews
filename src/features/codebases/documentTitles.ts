import { branchBeingRead, commitBeingRead, pullBeingRead, repoBeingRead } from './repoPaths';
import type { CurrentLocal } from '@/features/local-git/currentLocalStore';
import { commandLine, repoName } from '@/features/local-git/localRoutes';
import { shortSha } from '@/features/pull-requests/pullPaths';
import { SETTINGS_ROUTE } from '@/features/settings/settings';

const SUFFIX = 'reposcope';
export const DEFAULT_TITLE = `${SUFFIX} — pull request viewer`;
const PAGE_TITLES: Record<string, string> = { '/pulls': 'All pull requests', [SETTINGS_ROUTE]: 'Settings' };

export function titleFor(pathname: string, pullTitle: string | null): string {
  const repo = repoBeingRead(pathname);
  if (!repo) return pageTitle(pathname);
  const scope = `${repo.owner}/${repo.name} · ${SUFFIX}`;
  const lead = pullLead(pathname, pullTitle) ?? commitLead(pathname) ?? branchBeingRead(pathname);
  return lead ? `${lead} · ${scope}` : scope;
}

function pageTitle(pathname: string): string {
  const page = PAGE_TITLES[pathname];
  return page ? `${page} · ${SUFFIX}` : DEFAULT_TITLE;
}

function pullLead(pathname: string, pullTitle: string | null): string | null {
  const number = pullBeingRead(pathname);
  if (number === null) return null;
  return `#${number}${pullTitle ? ` ${pullTitle}` : ''}`;
}

function commitLead(pathname: string): string | null {
  const sha = commitBeingRead(pathname);
  if (!sha) return null;
  return shortSha(sha);
}

export function localTitle({ repo, target }: CurrentLocal): string {
  const scope = `${repoName(repo)} · ${SUFFIX}`;
  return target ? `${commandLine(target)} · ${scope}` : scope;
}
