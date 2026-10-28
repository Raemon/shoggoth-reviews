import { resolveCommit } from './repoFiles';
import { countTarballLines, TAR_LINE_MEMORY_BYTES, type TarballLines } from './tarLineCounter';
import { githubDerived } from '@/features/codebases/githubRequest';

export type RepoLineCounts = TarballLines;

const API = 'https://api.github.com';
// Bump when countTarballLines changes: results under this name are cached forever.
const DERIVATION = 'line-counts@3';

export async function countRepoLines(owner: string, name: string, ref: string): Promise<RepoLineCounts> {
  const sha = await resolveCommit(owner, name, ref);
  return githubDerived(`${API}/repos/${owner}/${name}/tarball/${sha}`, DERIVATION, TAR_LINE_MEMORY_BYTES, countTarballLines);
}
