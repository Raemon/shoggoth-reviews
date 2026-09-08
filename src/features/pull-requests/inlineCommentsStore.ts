'use client';

import { boolPref, usePref } from './localPref';

const expandedPref = boolPref('reposcope.inlineCommentsExpanded', true);

export function setInlineCommentsExpanded(on: boolean): void {
  expandedPref.set(on);
}

export function useInlineCommentsExpanded(): boolean {
  return usePref(expandedPref);
}
