'use client';

import { createContext } from 'react';
import type { PullRequestSummary } from './pullRequests';

export interface EditTargetValue {
  // Null commits straight to the repository's default branch.
  pull: PullRequestSummary | null;
  headRef: string;
  onCommitted?: () => void | Promise<void>;
}

export type EditSource = Omit<EditTargetValue, 'headRef'>;

export const EditTarget = createContext<EditTargetValue | null>(null);
