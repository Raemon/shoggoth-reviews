import { redirect } from 'next/navigation';
import { LocalChangeView } from './LocalChangeView';
import { repositoryRoot } from './localRepo';
import { LocalRepoOverview } from './LocalRepoOverview';
import { localChangeRoute, localRepoRoute, type LocalCommand } from './localRoutes';
import { paramList, paramValue, type PageParams } from './pageParams';
import { CentralLayoutProvider } from '@/features/pull-requests/centralLayout';
import { ColumnNavProvider } from '@/features/pull-requests/columnNav';
import { PaneStatusLine } from '@/features/surface-ui/PaneStatusLine';

export async function LocalOverviewPage({ params }: { params: PageParams }) {
  const repo = paramValue(params, 'repo');
  const root = await rootOf(repo);
  if (root === null) return <MissingRepo repo={repo} />;
  if (root !== repo) redirect(localRepoRoute(root));
  return (
    <div className="p-6">
      <ColumnNavProvider>
        <LocalRepoOverview repo={root} />
      </ColumnNavProvider>
    </div>
  );
}

export async function LocalChangePage({ params, command }: { params: PageParams; command: LocalCommand }) {
  const repo = paramValue(params, 'repo');
  const root = await rootOf(repo);
  if (root === null) return <MissingRepo repo={repo} />;
  const target = { repo: root, command, args: paramList(params, 'arg') };
  if (root !== repo) redirect(localChangeRoute(target));
  return (
    <ColumnNavProvider>
      <CentralLayoutProvider>
        <LocalChangeView target={target} />
      </CentralLayoutProvider>
    </ColumnNavProvider>
  );
}

function rootOf(repo: string | null): Promise<string | null> {
  return repo === null ? Promise.resolve(null) : repositoryRoot(repo).catch(() => null);
}

function MissingRepo({ repo }: { repo: string | null }) {
  return (
    <PaneStatusLine tone="error" className="m-4">
      Not a git repository: {repo ?? '(no path given)'}
    </PaneStatusLine>
  );
}
