import { requireParam } from '@/features/github-auth/apiRoute';
import { localApiRoute, refParam, repoParam } from '@/features/local-git/localApi';
import { readLocalBlob } from '@/features/local-git/localFiles';
import { PATH_PATTERN } from '@/features/pull-requests/routeParams';

export async function GET(request: Request) {
  return localApiRoute(request, () =>
    readLocalBlob(repoParam(request), refParam(request), requireParam(request, 'path', PATH_PATTERN)),
  );
}
