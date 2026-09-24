import { localApiRoute, refParam, repoParam } from '@/features/local-git/localApi';
import { countLocalLines } from '@/features/local-git/localFiles';

export async function GET(request: Request) {
  return localApiRoute(request, () => countLocalLines(repoParam(request), refParam(request)));
}
