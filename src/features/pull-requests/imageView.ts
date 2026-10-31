import type { ChangedFile } from './pullRequests';
import { WHOLE_FILE_STATUS } from './wholeFileEntry';

export interface FileSource {
  ref: string;
  path: string;
}

export interface ImageGallery {
  owner: string;
  repo: string;
  files: ChangedFile[];
  baseRef: string;
  headRef: string;
}

export interface ImageFileView {
  owner: string;
  repo: string;
  file: ChangedFile;
  baseRef: string;
  headRef: string;
}

export function imageSides(
  file: ChangedFile,
  baseRef: string,
  headRef: string,
): { before: FileSource | null; after: FileSource | null } {
  return { before: beforeSide(file, baseRef), after: afterSide(file, headRef) };
}

function beforeSide(file: ChangedFile, baseRef: string): FileSource | null {
  if (file.status === 'added' || file.status === WHOLE_FILE_STATUS) return null;
  return { ref: baseRef, path: file.previousFilename ?? file.filename };
}

function afterSide(file: ChangedFile, headRef: string): FileSource | null {
  if (file.status === 'removed') return null;
  return { ref: headRef, path: file.filename };
}

export function previewSource(file: ChangedFile, baseRef: string, headRef: string): FileSource {
  const { before, after } = imageSides(file, baseRef, headRef);
  return after ?? before ?? { ref: headRef, path: file.filename };
}
