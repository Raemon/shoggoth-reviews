import { isImagePath } from '../pull-requests/imageFiles';
import type { RepoFileSet } from '@/features/pull-requests/repoFiles';

export function isMapAsset(path: string): boolean {
  return isImagePath(path) || /\.(wasm|woff2?|ttf|otf|zip|gz|pdf|mp[34]|mov|ico|exe|dll|so|dylib)$/i.test(path);
}

export function sourceFileSet(fileSet: RepoFileSet, includeAssets: boolean): RepoFileSet {
  return includeAssets ? fileSet : { ...fileSet, files: fileSet.files.filter((path) => !isMapAsset(path)) };
}
