import { githubCliToken } from '@/features/desktop/githubCliToken';
import { localApiRoute } from '@/features/local-git/localApi';

export async function POST(request: Request) {
  return localApiRoute(request, githubCliToken);
}
