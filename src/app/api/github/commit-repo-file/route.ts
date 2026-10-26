import { apiRoute, requireParam } from '@/features/github-auth/apiRoute';
import { fileEdit } from '@/features/pull-requests/commitRequests';
import { commitDefaultBranchEdit } from '@/features/pull-requests/pullRequests';
import { LOGIN_PATTERN, REPO_NAME_PATTERN } from '@/features/sources/sourceTypes';

export async function POST(request: Request) {
  return apiRoute(request, async () =>
    commitDefaultBranchEdit(
      requireParam(request, 'owner', LOGIN_PATTERN),
      requireParam(request, 'name', REPO_NAME_PATTERN),
      fileEdit(await request.json()),
    ),
  );
}
