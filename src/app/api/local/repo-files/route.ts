import { localApiRoute, refParam, repoParam } from '@/features/local-git/localApi';
import { listLocalFiles } from '@/features/local-git/localFiles';

export async function GET(request: Request) {
  const ref = new URL(request.url).searchParams.get('ref');
  return localApiRoute(request, () =>
    listLocalFiles(repoParam(request), ref === null ? undefined : refParam(request)),
  );
}
