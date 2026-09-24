import { requireParam } from '@/features/github-auth/apiRoute';
import { localApiRoute, repoParam } from '@/features/local-git/localApi';
import { readLocalText } from '@/features/local-git/localFiles';
import { LOCAL_REF_PATTERN } from '@/features/local-git/localRefs';
import { PATH_PATTERN } from '@/features/pull-requests/routeParams';

export async function GET(request: Request) {
  return localApiRoute(request, () =>
    readLocalText(repoParam(request), requireParam(request, 'ref', LOCAL_REF_PATTERN), requireParam(request, 'path', PATH_PATTERN)),
  );
}
