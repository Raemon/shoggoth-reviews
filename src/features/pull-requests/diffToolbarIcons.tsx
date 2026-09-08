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

export function CollapseExceptTypesIcon() {
  return (
    <ToolbarIcon>
      <FoldedLines />
      <path d="M13.5 6.5h7M17 6.5v11" />
    </ToolbarIcon>
  );
}

export function CollapseHidingCommentsIcon() {
  return (
    <ToolbarIcon>
      <FoldedLines />
      <path d="M14 17.5 17 6.5M18 17.5 21 6.5" strokeDasharray="2 2.6" />
    </ToolbarIcon>
  );
}

export function CollapseExceptCommentsIcon() {
  return (
    <ToolbarIcon>
      <FoldedLines />
      <path d="M14 17.5 17 6.5M18 17.5 21 6.5" />
    </ToolbarIcon>
  );
}

const GITHUB_MARK =
  'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12';

export function GitHubIcon() {
  return (
    <ToolbarIcon>
      <path d={GITHUB_MARK} fill="currentColor" stroke="none" transform="translate(3 3) scale(0.75)" />
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
  return <path d="M3.5 4.5h17M3.5 19.5h17" />;
}

export function CollapseAllFilesIcon() {
  return (
    <ToolbarIcon>
      <FileHeaderBars />
      <path d="M8 15 12 11.5 16 15" />
    </ToolbarIcon>
  );
}

export function ExpandAllFilesIcon() {
  return (
    <ToolbarIcon>
      <FileHeaderBars />
      <path d="M8 9 12 12.5 16 9" />
    </ToolbarIcon>
  );
}
