import { CodebaseMap } from '@/features/codebase-map/CodebaseMap';

export default async function CodebaseMapPage({ params }: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await params;
  return <CodebaseMap key={`${owner}/${repo}`} owner={owner} repo={repo} />;
}
