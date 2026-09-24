'use client';

import { useColumnNav, type ColumnRow } from './columnNav';
import type { ColumnId } from './navColumn';
import { HoverCardTrigger } from '@/features/surface-ui/HoverCard';
import type { RowState } from '@/features/surface-ui/rowState';

export interface PreviewToken {
  key: string;
  label: string;
  title: string;
  accent?: boolean;
  serif?: boolean;
}

const CHIP_TONE: Record<RowState, string> = {
  plain: 'bg-btn text-ink-dim',
  highlighted: 'bg-btn-hover text-ink outline outline-1 outline-ink',
  selected: 'bg-btn-active text-accent',
  both: 'bg-btn-both text-accent outline outline-1 outline-ink',
};

const CHIP =
  'shrink-0 rounded-[3px] px-[3px] py-[2px] font-mono text-[9px] leading-none tracking-tight normal-case outline-none focus-visible:ring-1 focus-visible:ring-accent';

export function branchToken(name: string): string {
  return (name.split('/').pop() ?? name).slice(0, 2);
}

export function ColumnPreview({ tokens, column }: { tokens: PreviewToken[]; column: ColumnId }) {
  const nav = useColumnNav(column);
  if (tokens.length === 0) return null;
  return (
    <span className="flex min-h-0 flex-1 items-center justify-end gap-[3px] overflow-auto md:flex-col md:justify-start md:[mask-image:linear-gradient(to_bottom,black_calc(100%-20px),transparent)]">
      {tokens.map((token) => (
        <PreviewChip key={token.key} token={token} row={nav.row(token.key, token.accent ?? false)} activate={nav.activate} />
      ))}
    </span>
  );
}

function PreviewChip({ token, row, activate }: { token: PreviewToken; row: ColumnRow; activate: (item: string) => void }) {
  return (
    <HoverCardTrigger label={token.title} focusable={false} tooltipStyle serifLabel={token.serif ?? false}>
      <button
        type="button"
        data-nav-cursor={row.props.cursor || undefined}
        onPointerEnter={row.props.onPointerEnter}
        onClick={(event) => {
          event.stopPropagation();
          activate(token.key);
        }}
        className={`${CHIP} ${CHIP_TONE[row.state]}`}
      >
        {token.label}
      </button>
    </HoverCardTrigger>
  );
}
