import { githubDerived } from '@/features/codebases/githubRequest';
import { deriveMapPreviews, previewPage } from './mapPreviewArchive';
import type { MapPreviewPage } from './mapPreviewTypes';

const DERIVATION = 'folded-map-previews@1';

export async function repoMapPreviews(owner: string, repo: string, sha: string, cursor: number): Promise<MapPreviewPage> {
  const index = await githubDerived(`https://api.github.com/repos/${owner}/${repo}/tarball/${sha}`, DERIVATION, deriveMapPreviews);
  return previewPage(index, cursor);
}
