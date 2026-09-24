import { branchBeingRead, pullBeingRead, repoBeingRead } from './repoPaths';
import type { CurrentLocal } from '@/features/local-git/currentLocalStore';
import { SETTINGS_ROUTE } from '@/features/settings/settings';
import { commandLine, repoName } from '@/features/local-git/localRoutes';

const SUFFIX = 'reposcope';
export const DEFAULT_TITLE = `${SUFFIX} — pull request viewer`;
const PAGE_TITLES: Record<string, string> = { '/pulls': 'All pull requests', [SETTINGS_ROUTE]: 'Settings' };

export function titleFor(pathname: string, pullTitle: string | null): string {
  const repo = repoBeingRead(pathname);
  if (!repo) return pageTitle(pathname);
  const scope = `${repo.owner}/${repo.name} · ${SUFFIX}`;
  const lead = pullLead(pathname, pullTitle) ?? branchBeingRead(pathname);
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

export function localTitle({ repo, target }: CurrentLocal): string {
  const scope = `${repoName(repo)} · ${SUFFIX}`;
  return target ? `${commandLine(target)} · ${scope}` : scope;
}
