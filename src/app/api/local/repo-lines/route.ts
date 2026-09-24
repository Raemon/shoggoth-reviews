import { requireParam } from '@/features/github-auth/apiRoute';
import { localApiRoute, repoParam } from '@/features/local-git/localApi';
import { countLocalLines } from '@/features/local-git/localFiles';
import { LOCAL_REF_PATTERN } from '@/features/local-git/localRefs';

export async function GET(request: Request) {
  return localApiRoute(request, () => countLocalLines(repoParam(request), requireParam(request, 'ref', LOCAL_REF_PATTERN)));
}
