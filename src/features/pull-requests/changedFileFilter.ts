import type { ChangedFile } from './pullRequests';

const FILTER_FROM = 5;

export function showsFileFilter(total: number): boolean {
  return total > FILTER_FROM;
}

export function filterChangedFiles(files: ChangedFile[] | null, query: string): ChangedFile[] | null {
  const wanted = query.trim().toLowerCase();
  if (files === null || wanted === '') return files;
  return files.filter((file) => file.filename.toLowerCase().includes(wanted));
}
