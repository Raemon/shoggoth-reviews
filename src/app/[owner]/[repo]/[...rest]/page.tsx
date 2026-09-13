import { redirect } from 'next/navigation';
import { githubShapedRoute } from '@/features/codebases/githubShapedRoute';
import { decodePathSegments } from '@/features/codebases/repoPaths';

export default async function GithubShapedPathPage({ params }: { params: Promise<{ owner: string; repo: string; rest: string[] }> }) {
  const { owner, repo, rest } = await params;
  const route = await githubShapedRoute(owner, repo, decodePathSegments(rest.join('/')));
  redirect(route);
}
