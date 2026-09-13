import { apiRoute, requireParam } from '@/features/github-auth/apiRoute';
import { repoMapPreviews } from '@/features/codebase-map/repoMapPreviews';
import { COMMIT_SHA_PATTERN, LOGIN_PATTERN, REPO_NAME_PATTERN } from '@/features/sources/sourceTypes';

export const maxDuration = 300;

export async function GET(request: Request) {
  return apiRoute(request, () => repoMapPreviews(
    requireParam(request, 'owner', LOGIN_PATTERN),
    requireParam(request, 'repo', REPO_NAME_PATTERN),
    requireParam(request, 'sha', COMMIT_SHA_PATTERN),
    Number(requireParam(request, 'cursor', /^\d{1,7}$/)),
  ));
}
