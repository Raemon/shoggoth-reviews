import type { ReactNode } from 'react';
import { StrokeIcon } from '@/features/surface-ui/StrokeIcon';
import type { ActionKind } from './chatActionMeta';

const PATHS: Record<ActionKind, ReactNode> = {
  thinking: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M8 10a4 4 0 1 1 8 0c0 1.6-.7 2.4-1.5 3.5H9.5C8.7 12.4 8 11.6 8 10Z" />
    </>
  ),
  notice: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 11v5M12 8v.5" />
    </>
  ),
  error: (
    <>
      <path d="M12 4 21 20H3Z" />
      <path d="M12 10v5M12 17.5v.5" />
    </>
  ),
  shell: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />
      <path d="M7 10l3 2.5L7 15M12 15h5" />
    </>
  ),
  read: (
    <>
      <path d="M7 4h7l5 5v11H7Z" />
      <path d="M14 4v5h5" />
    </>
  ),
  edit: (
    <>
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4Z" />
      <path d="M14.5 5.5l3 3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="5.5" />
      <path d="M15.5 15.5 20 20" />
    </>
  ),
  web: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16M12 4a11 11 0 0 1 0 16M12 4a11 11 0 0 0 0 16" />
    </>
  ),
  image: (
    <>
      <rect x="4" y="6" width="16" height="13" rx="1.5" />
      <circle cx="9" cy="11" r="1.5" />
      <path d="M8 16.5 11 13l3 3 2-2 3 3" />
    </>
  ),
  delete: (
    <>
      <path d="M5 7h14M9.5 7V5.5h5V7M7 7l1 12h8l1-12" />
      <path d="M10.5 10.5v6M13.5 10.5v6" />
    </>
  ),
  tool: (
    <>
      <path d="M14.5 6.5a3.5 3.5 0 0 0-4.7 4.7L5 16l3 3 4.8-4.8a3.5 3.5 0 0 0 4.7-4.7L15 12l-3-3Z" />
    </>
  ),
};

export function ActionIcon({ kind }: { kind: ActionKind }) {
  return (
    <StrokeIcon size={12} className="shrink-0">
      {PATHS[kind]}
    </StrokeIcon>
  );
}

export function ChevronIcon({ open }: { open: boolean }) {
  return (
    <StrokeIcon size={10} className={`shrink-0 ${open ? 'rotate-90' : ''}`}>
      <path d="M9 7l6 5-6 5" />
    </StrokeIcon>
  );
}
