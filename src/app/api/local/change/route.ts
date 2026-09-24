import { argsParam, commandParam, localApiRoute, repoParam } from '@/features/local-git/localApi';
import { describeLocalChange } from '@/features/local-git/localChange';

export async function GET(request: Request) {
  return localApiRoute(request, () => describeLocalChange(repoParam(request), commandParam(request), argsParam(request)));
}
