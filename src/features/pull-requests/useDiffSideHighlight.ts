'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { EXPAND_MS } from './diffMetrics';
import { langForPath, tokenizeCode, type ThemedToken } from './diffHighlight';
import { intralineRanges, type IntralineRanges } from './intralineDiff';
import { LARGE_FILE_BYTES } from './sizeLimits';
import { type DiffCell, type DiffRow } from './splitDiff';

export interface SideTokens {
  left: (ThemedToken[] | null)[];
  right: (ThemedToken[] | null)[];
}

export function useIntralineEmphasis(rows: DiffRow[]): (IntralineRanges | null)[] {
  return useMemo(() => emphasizeRows(rows), [rows]);
}

function emphasizeRows(rows: DiffRow[]): (IntralineRanges | null)[] {
  return rows.map((row) =>
    row.kind === 'change' && row.left && row.right ? intralineRanges(row.left.text, row.right.text) : null,
  );
}

export function useDiffTokens(rows: DiffRow[], filename: string): SideTokens | null {
  const [tokens, setTokens] = useState<SideTokens | null>(null);
  const tokenizedOnce = useRef(false);
  useEffect(() => {
    setTokens(null);
    const lang = langForPath(filename);
    if (!lang) return;
    const left = joinedCellText(rows.map((row) => row.left));
    const right = joinedCellText(rows.map((row) => row.right));
    // Highlighting one side of a split diff but not the other reads as a rendering bug.
    if (Math.max(left.length, right.length) > LARGE_FILE_BYTES) return;
    let cancelled = false;
    const stopped = () => cancelled;
    const highlight = () =>
      Promise.all([tokenizeCode(left, lang, stopped), tokenizeCode(right, lang, stopped)]).then(([leftLines, rightLines]) => {
        if (cancelled || (!leftLines && !rightLines)) return;
        setTokens(alignTokensToRows(rows, leftLines, rightLines));
      });
    // Let the expand animation finish before a whole-file re-tokenize.
    const delay = tokenizedOnce.current ? EXPAND_MS : 0;
    tokenizedOnce.current = true;
    const scheduled = setTimeout(highlight, delay);
    return () => {
      cancelled = true;
      clearTimeout(scheduled);
    };
  }, [rows, filename]);
  return tokens;
}

function joinedCellText(cells: (DiffCell | null)[]): string {
  return cells
    .filter((cell): cell is DiffCell => cell !== null)
    .map((cell) => cell.text)
    .join('\n');
}

function alignTokensToRows(
  rows: DiffRow[],
  leftLines: ThemedToken[][] | null,
  rightLines: ThemedToken[][] | null,
): SideTokens {
  const left: (ThemedToken[] | null)[] = [];
  const right: (ThemedToken[] | null)[] = [];
  let leftIndex = 0;
  let rightIndex = 0;
  for (const row of rows) {
    left.push(row.left && leftLines ? (leftLines[leftIndex] ?? null) : null);
    if (row.left) leftIndex += 1;
    right.push(row.right && rightLines ? (rightLines[rightIndex] ?? null) : null);
    if (row.right) rightIndex += 1;
  }
  return { left, right };
}
