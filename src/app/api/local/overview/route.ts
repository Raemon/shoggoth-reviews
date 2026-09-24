import { localApiRoute, repoParam } from '@/features/local-git/localApi';
import { describeLocalRepo } from '@/features/local-git/localOverview';

export async function GET(request: Request) {
  return localApiRoute(request, () => describeLocalRepo(repoParam(request)));
}
