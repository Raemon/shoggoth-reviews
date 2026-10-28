import { apiRoute, requireParam } from '@/features/github-auth/apiRoute';
import { readFileText } from '@/features/pull-requests/pullRequests';
import { byteLimitParam } from '@/features/pull-requests/routeParams';
import { LOGIN_PATTERN, REF_PATTERN, REPO_NAME_PATTERN } from '@/features/sources/sourceTypes';

const PATH_PATTERN = /^(?!\/)(?!.*\.\.)[^\0]{1,1024}$/;

export async function GET(request: Request) {
  return apiRoute(request, () =>
    readFileText(
      requireParam(request, 'owner', LOGIN_PATTERN),
      requireParam(request, 'name', REPO_NAME_PATTERN),
      requireParam(request, 'ref', REF_PATTERN),
      requireParam(request, 'path', PATH_PATTERN),
      byteLimitParam(request),
    ),
  );
}
