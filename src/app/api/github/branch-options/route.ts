import { apiRoute, optionalParam, requireParam } from '@/features/github-auth/apiRoute';
import { listBranchOptions } from '@/features/pull-requests/branches';
import { LOGIN_PATTERN, REPO_NAME_PATTERN } from '@/features/sources/sourceTypes';

const FILTER_LENGTH = 100;

export async function GET(request: Request) {
  return apiRoute(request, () =>
    listBranchOptions(
      requireParam(request, 'owner', LOGIN_PATTERN),
      requireParam(request, 'name', REPO_NAME_PATTERN),
      optionalParam(request, 'filter', FILTER_LENGTH),
    ),
  );
}
