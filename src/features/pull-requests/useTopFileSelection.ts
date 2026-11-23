'use client';

import { useCallback } from 'react';
import { useNavRegistry } from './columnNav';
import type { ColumnId } from './navColumn';

const FILE_COLUMNS: ColumnId[] = ['files', 'diff'];

// Arrow keys step from the cursor; left behind, it would jump the reader back to it.
export function useTopFileSelection(select: (path: string) => void): (path: string) => void {
  const { dropCursors } = useNavRegistry();
  return useCallback(
    (path: string) => {
      select(path);
      dropCursors(FILE_COLUMNS);
    },
    [select, dropCursors],
  );
}
