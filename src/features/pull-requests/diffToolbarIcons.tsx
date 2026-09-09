import { StrokeIcon as ToolbarIcon } from '@/features/surface-ui/StrokeIcon';

export function SplitViewIcon() {
  return (
    <ToolbarIcon>
      <rect x="2.5" y="4" width="8" height="16" rx="1.5" />
      <rect x="13.5" y="4" width="8" height="16" rx="1.5" />
    </ToolbarIcon>
  );
}

export function UnifiedViewIcon() {
  return (
    <ToolbarIcon>
      <rect x="2.5" y="4" width="19" height="16" rx="1.5" />
      <path d="M6.5 9.5h11M6.5 14.5h7" />
    </ToolbarIcon>
  );
}

export function ResultViewIcon() {
  return (
    <ToolbarIcon>
      <rect x="2.5" y="4" width="19" height="16" rx="1.5" />
      <path d="M6.5 9.5h11M6.5 14.5h7" />
      <path d="M17.5 15v5M15 17.5h5" />
    </ToolbarIcon>
  );
}

export function SmartFoldIcon() {
  return (
    <ToolbarIcon>
      <path d="M4 4.5h16M4 8.5h11" />
      <path d="M4 12.5h16" strokeDasharray="2.5 3" />
      <path d="M4 16.5h11M4 20.5h16" />
    </ToolbarIcon>
  );
}

export function ExpandAllIcon() {
  return (
    <ToolbarIcon>
      <path d="M3.5 4.5h17M3.5 19.5h17" />
      <path d="M8 10 12 6.5 16 10M8 14 12 17.5l4-3.5" />
    </ToolbarIcon>
  );
}

function FoldedLines() {
  return <path d="M3.5 6.5h7M3.5 12h7M3.5 17.5h7" />;
}

export function CollapseAllCodeIcon() {
  return (
    <ToolbarIcon>
      <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" />
    </ToolbarIcon>
  );
}

export function ExpandTypesIcon() {
  return (
    <ToolbarIcon>
      <FoldedLines />
      <path d="M13.5 6.5h7M17 6.5v11" />
    </ToolbarIcon>
  );
}

export function ExpandCommentsIcon() {
  return (
    <ToolbarIcon>
      <FoldedLines />
      <path d="M14 17.5 17 6.5M18 17.5 21 6.5" />
    </ToolbarIcon>
  );
}

export function ExpandFunctionsIcon() {
  return (
    <ToolbarIcon>
      <FoldedLines />
      <path d="M20.5 6.5c-2.2 0-3.2 1-3.5 3l-1.2 8M13.5 11.5h5.5" />
    </ToolbarIcon>
  );
}

export function SearchIcon() {
  return (
    <ToolbarIcon>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5.5 5.5" />
    </ToolbarIcon>
  );
}

export function EditIcon() {
  return (
    <ToolbarIcon>
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4Z" />
      <path d="M14.5 5.5l3 3" />
    </ToolbarIcon>
  );
}

export function SortIcon() {
  return (
    <ToolbarIcon>
      <path d="M7 20V4M3.5 7.5 7 4l3.5 3.5" />
      <path d="M17 4v16M13.5 16.5 17 20l3.5-3.5" />
    </ToolbarIcon>
  );
}

export function WrapLinesIcon() {
  return (
    <ToolbarIcon>
      <path d="M3.5 5.5h17M3.5 18.5h6" />
      <path d="M3.5 12h13a3.5 3.5 0 0 1 0 6.5h-2.5" />
      <path d="M16 15.5 13.5 18.5 16 21.5" />
    </ToolbarIcon>
  );
}

export function TrashIcon() {
  return (
    <ToolbarIcon size={14}>
      <path d="M4 6.5h16" />
      <path d="M9.5 6.5V4.5h5v2" />
      <path d="M6.5 6.5 7.5 20.5h9l1-14" />
      <path d="M10.5 10v7M13.5 10v7" />
    </ToolbarIcon>
  );
}

function FileHeaderBars() {
  return (
    <>
      <rect x="3" y="2.5" width="18" height="5" rx="1.5" />
      <rect x="3" y="16.5" width="18" height="5" rx="1.5" />
    </>
  );
}

export function CollapseAllFilesIcon() {
  return (
    <ToolbarIcon>
      <FileHeaderBars />
      <path d="M9 13.5 12 10 15 13.5" />
    </ToolbarIcon>
  );
}
