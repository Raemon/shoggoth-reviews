import { redirect } from 'next/navigation';
import { LocalChangeView } from './LocalChangeView';
import { repositoryRoot } from './localRepo';
import { LocalRepoOverview } from './LocalRepoOverview';
import { localChangeRoute, localRepoRoute, type LocalCommand } from './localRoutes';
import { paramList, paramValue, type PageParams } from './pageParams';
import { CentralLayoutProvider } from '@/features/pull-requests/centralLayout';
import { ColumnNavProvider } from '@/features/pull-requests/columnNav';
import { desktopOnly } from '@/features/desktop/desktopMode';
import { PaneStatusLine } from '@/features/surface-ui/PaneStatusLine';

export async function LocalOverviewPage({ params }: { params: PageParams }) {
  await desktopOnly();
  const { repo, root } = await canonicalRoot(params, localRepoRoute);
  if (root === null) return <MissingRepo repo={repo} />;
  return (
    <div className="p-6">
      <ColumnNavProvider>
        <LocalRepoOverview repo={root} />
      </ColumnNavProvider>
    </div>
  );
}

export async function LocalChangePage({ params, command }: { params: PageParams; command: LocalCommand }) {
  await desktopOnly();
  const args = paramList(params, 'arg');
  const { repo, root } = await canonicalRoot(params, (canonical) => localChangeRoute({ repo: canonical, command, args }));
  if (root === null) return <MissingRepo repo={repo} />;
  return (
    <ColumnNavProvider>
      <CentralLayoutProvider>
        <LocalChangeView target={{ repo: root, command, args }} />
      </CentralLayoutProvider>
    </ColumnNavProvider>
  );
}

async function canonicalRoot(params: PageParams, routeFor: (root: string) => string) {
  const repo = paramValue(params, 'repo');
  const root = repo === null ? null : await repositoryRoot(repo).catch(() => null);
  if (root !== null && root !== repo) redirect(routeFor(root));
  return { repo, root };
}

function MissingRepo({ repo }: { repo: string | null }) {
  return (
    <PaneStatusLine tone="error" className="m-4">
      Not a git repository: {repo ?? '(no path given)'}
    </PaneStatusLine>
  );
}
