'use client';

import { useMemo, type MouseEvent } from 'react';
import { changedFileSides, type PeekSides } from './definitionContext';
import type { PeekOrigin } from './definitionFrames';
import { useDefinitionPeekActions, type PeekActions, type PeekAnchor } from './definitionPeekStore';
import type { DiffLine } from './diffLines';
import { diffEditModeOn } from './editModeStore';
import { identifierAtPoint } from './identifierAt';
import type { ChangedFile } from './pullRequests';

export interface CodePointer {
  press(line: DiffLine, event: MouseEvent<HTMLElement>): void;
  move(line: DiffLine, event: MouseEvent<HTMLElement>): void;
  leave(): void;
}

export interface PointedOrigin {
  origin: PeekOrigin;
  anchor: PeekAnchor;
}

export function originAtPoint(sides: PeekSides, line: DiffLine, event: MouseEvent<HTMLElement>): PointedOrigin | null {
  if (!line.cell || line.kind === 'hunk') return null;
  const found = identifierAtPoint(event, event.currentTarget);
  const at = found && sideOf(sides, line.side);
  if (!found || !at) return null;
  const origin = { ...at, line: line.cell.line, column: found.column, word: found.word };
  return { origin, anchor: wordAnchor(found.range) };
}

function wordAnchor(range: Range): PeekAnchor {
  const { left, top, bottom } = range.getBoundingClientRect();
  return { left, top, bottom, range };
}

function sideOf(sides: PeekSides, side: 'left' | 'right'): { ref: string; path: string } | null {
  const ref = side === 'left' ? sides.leftRef : sides.rightRef;
  return ref === null ? null : { ref, path: side === 'left' ? sides.leftPath : sides.rightPath };
}

export function useDefinitionPointer(file: ChangedFile, baseRef: string, headRef: string): CodePointer | undefined {
  const actions = useDefinitionPeekActions();
  return useMemo(
    () => (actions ? codePointer(actions, changedFileSides(file, baseRef, headRef)) : undefined),
    [actions, file, baseRef, headRef],
  );
}

function codePointer(actions: PeekActions, sides: PeekSides): CodePointer {
  const pointing = (event: MouseEvent<HTMLElement>) => event.buttons === 0 && !diffEditModeOn();
  return {
    press(line, event) {
      if (event.detail !== 1 || diffEditModeOn()) return;
      const pointed = originAtPoint(sides, line, event);
      if (pointed) actions.open(pointed.origin, pointed.anchor);
    },
    move(line, event) {
      const pointed = pointing(event) ? originAtPoint(sides, line, event) : null;
      if (pointed) actions.hover(pointed.origin, pointed.anchor);
      else actions.unhover();
    },
    leave: actions.unhover,
  };
}
