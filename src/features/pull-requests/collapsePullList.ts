'use client';

import { setStickyColumn } from './stickyColumns';

export type PullListColumnName = 'pulls' | 'all-pulls';

export function collapsePullList(name: PullListColumnName): void {
  setStickyColumn(name, (held) => ({ ...held, open: false }));
}
