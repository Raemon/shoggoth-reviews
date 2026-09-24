export const LOCAL_OWNER = '~local';

// Neither can be a git ref name, since ref names may not contain ':'.
export const WORKTREE_REF = ':worktree';
export const INDEX_REF = ':index';

export const LOCAL_REF_PATTERN = /^(?::worktree|:index|[0-9a-f]{40}|[0-9a-f]{64})$/;

export function isLocalRepo(owner: string): boolean {
  return owner === LOCAL_OWNER;
}
