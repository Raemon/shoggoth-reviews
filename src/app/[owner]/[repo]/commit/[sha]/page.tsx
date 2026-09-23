import { ColumnNavProvider } from '@/features/pull-requests/columnNav';
import { CommitView } from '@/features/pull-requests/CommitView';

export default async function CommitPage({ params }: { params: Promise<{ owner: string; repo: string; sha: string }> }) {
  const { owner, repo, sha } = await params;
  return (
    <ColumnNavProvider>
      <CommitView owner={owner} repo={repo} sha={sha.toLowerCase()} />
    </ColumnNavProvider>
  );
}
