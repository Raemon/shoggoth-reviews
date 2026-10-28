export const BRANCH_NAME_PATTERN = /^(?!-)(?!.*\.\.)[^\s~^:?*[\\\x00-\x1f\x7f]{1,255}$/;
export const PULL_NUMBER_PATTERN = /^[0-9]{1,9}$/;
export const PATH_PATTERN = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[^\0]{1,1024}$/;

export function byteLimitParam(request: Request): number | null {
  const asked = Number(new URL(request.url).searchParams.get('max'));
  return Number.isSafeInteger(asked) && asked > 0 ? asked : null;
}
