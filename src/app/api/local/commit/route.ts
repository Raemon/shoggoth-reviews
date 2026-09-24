import { requireParam } from '@/features/github-auth/apiRoute';
import { localApiRoute, repoParam } from '@/features/local-git/localApi';
import { listLocalCommitFiles } from '@/features/local-git/localChange';

const SHA_PATTERN = /^[0-9a-f]{7,64}$/;

export async function GET(request: Request) {
  return localApiRoute(request, () => listLocalCommitFiles(repoParam(request), requireParam(request, 'sha', SHA_PATTERN)));
}
