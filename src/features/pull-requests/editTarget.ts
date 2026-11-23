'use client';

import { createContext, useMemo, useRef } from 'react';
import type { PullRequestSummary } from './pullRequests';

export interface EditTargetValue {
  pull: PullRequestSummary;
  headRef: string;
  onCommitted?: () => void | Promise<void>;
}

export const EditTarget = createContext<EditTargetValue | null>(null);

type Committed = EditTargetValue['onCommitted'];

// Every diff line sits under this context; a value rebuilt each render would redraw them.
export function useEditTargetValue(pull: PullRequestSummary | null, headRef: string | undefined, onCommitted: Committed) {
  const latest = useRef(onCommitted);
  latest.current = onCommitted;
  return useMemo(() => editTargetFor(pull, headRef, () => latest.current?.()), [pull, headRef]);
}

function editTargetFor(pull: PullRequestSummary | null, headRef: string | undefined, onCommitted: Committed): EditTargetValue | null {
  return pull && headRef !== undefined ? { pull, headRef, onCommitted } : null;
}
