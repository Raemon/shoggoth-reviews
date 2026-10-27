'use client';

import { enumPref, usePref } from './localPref';

const SORTS = ['folder', 'comments', 'diff', 'diffAll'] as const;

export type DiffSort = (typeof SORTS)[number];

const sortPref = enumPref<DiffSort>('reposcope.diffSort', SORTS, 'folder');

export function setDiffSort(sort: DiffSort): void {
  sortPref.set(sort);
}

export function useDiffSort(): DiffSort {
  return usePref(sortPref);
}
