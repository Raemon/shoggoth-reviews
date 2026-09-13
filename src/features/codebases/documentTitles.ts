import { branchBeingRead, pullBeingRead, repoBeingRead, repoRoute } from './repoPaths';

const SUFFIX = 'reposcope';
export const DEFAULT_TITLE = `${SUFFIX} — pull request viewer`;

export function titleFor(pathname: string, pullTitle: string | null): string {
  const repo = repoBeingRead(pathname);
  if (!repo) return pathname === '/pulls' ? `All pull requests · ${SUFFIX}` : DEFAULT_TITLE;
  const scope = `${repo.owner}/${repo.name} · ${SUFFIX}`;
  if (pathname === `${repoRoute(repo.owner, repo.name)}/map`) return `Code map · ${scope}`;
  const lead = pullLead(pathname, pullTitle) ?? branchBeingRead(pathname);
  return lead ? `${lead} · ${scope}` : scope;
}

function pullLead(pathname: string, pullTitle: string | null): string | null {
  const number = pullBeingRead(pathname);
  if (number === null) return null;
  return `#${number}${pullTitle ? ` ${pullTitle}` : ''}`;
}
