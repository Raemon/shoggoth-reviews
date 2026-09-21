import type { ChangedFile } from './pullRequests';
import { matchesQuery } from '@/features/surface-ui/matchesQuery';

const FILTER_FROM = 5;

export function showsFileFilter(total: number, query: string): boolean {
  return total > FILTER_FROM || query !== '';
}

export function filterChangedFiles(files: ChangedFile[], query: string): ChangedFile[] {
  return files.filter((file) => matchesQuery(file.filename, query));
}
