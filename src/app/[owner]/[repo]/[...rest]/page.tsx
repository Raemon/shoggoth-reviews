import { redirect } from 'next/navigation';
import { repoSubpathRoute } from '@/features/codebases/githubUrlRoutes';
import { repoRoute } from '@/features/codebases/repoPaths';

export default async function GithubShapedPathPage({ params }: { params: Promise<{ owner: string; repo: string; rest: string[] }> }) {
  const { owner, repo, rest } = await params;
  redirect(repoSubpathRoute(owner, repo, rest) ?? repoRoute(owner, repo));
}
