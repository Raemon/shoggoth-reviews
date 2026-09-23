import { shortSha } from '@/features/pull-requests/pullPaths';
import { branchBeingRead, commitBeingRead, pullBeingRead, repoBeingRead } from './repoPaths';

const SUFFIX = 'reposcope';
export const DEFAULT_TITLE = `${SUFFIX} — pull request viewer`;

export function titleFor(pathname: string, pullTitle: string | null): string {
  const repo = repoBeingRead(pathname);
  if (!repo) return pathname === '/pulls' ? `All pull requests · ${SUFFIX}` : DEFAULT_TITLE;
  const scope = `${repo.owner}/${repo.name} · ${SUFFIX}`;
  const lead = pullLead(pathname, pullTitle) ?? commitLead(pathname) ?? branchBeingRead(pathname);
  return lead ? `${lead} · ${scope}` : scope;
}

function pullLead(pathname: string, pullTitle: string | null): string | null {
  const number = pullBeingRead(pathname);
  if (number === null) return null;
  return `#${number}${pullTitle ? ` ${pullTitle}` : ''}`;
}

function commitLead(pathname: string): string | null {
  const sha = commitBeingRead(pathname);
  return sha && shortSha(sha);
}
