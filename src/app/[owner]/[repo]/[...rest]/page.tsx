import { redirect } from 'next/navigation';
import { githubShapedRoute } from '@/features/codebases/githubShapedRoute';

export default async function GithubShapedPathPage({ params }: { params: Promise<{ owner: string; repo: string; rest: string[] }> }) {
  const { owner, repo, rest } = await params;
  redirect(await githubShapedRoute(owner, repo, rest));
}
