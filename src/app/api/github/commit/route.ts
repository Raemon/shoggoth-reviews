import { apiRoute, requireParam } from '@/features/github-auth/apiRoute';
import { describeCommit } from '@/features/pull-requests/pullRequests';
import { LOGIN_PATTERN, REPO_NAME_PATTERN } from '@/features/sources/sourceTypes';

const SHA_PATTERN = /^[0-9a-f]{7,40}$/;

export async function GET(request: Request) {
  return apiRoute(request, () =>
    describeCommit(
      requireParam(request, 'owner', LOGIN_PATTERN),
      requireParam(request, 'name', REPO_NAME_PATTERN),
      requireParam(request, 'sha', SHA_PATTERN),
    ),
  );
}
