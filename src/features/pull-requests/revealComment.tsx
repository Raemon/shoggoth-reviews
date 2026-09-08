'use client';

import { createContext, useContext } from 'react';

export type RevealComment = (path: string, rootId: number) => void;

export const RevealCommentContext = createContext<RevealComment | null>(null);

export function useRevealComment(): RevealComment | null {
  return useContext(RevealCommentContext);
}
