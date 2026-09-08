'use client';

import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { ColumnSize } from '@/features/pull-requests/ResizableColumn';

let shownFor: string | null = null;

export function useCloseOnNewSubject(subject: string, setSize: Dispatch<SetStateAction<ColumnSize>>): void {
  useEffect(() => {
    if (shownFor === subject) return;
    shownFor = subject;
    setSize((size) => (size.open ? { ...size, open: false } : size));
  }, [subject, setSize]);
}
