import { requireParam } from '@/features/github-auth/apiRoute';
import { localApiRoute, repoParam } from '@/features/local-git/localApi';
import { listLocalFiles } from '@/features/local-git/localFiles';
import { LOCAL_REF_PATTERN } from '@/features/local-git/localRefs';

export async function GET(request: Request) {
  const ref = new URL(request.url).searchParams.get('ref');
  return localApiRoute(request, () =>
    listLocalFiles(repoParam(request), ref === null ? undefined : requireParam(request, 'ref', LOCAL_REF_PATTERN)),
  );
}
