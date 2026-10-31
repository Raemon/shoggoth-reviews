'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { FileSource } from './imageView';
import { useFileText } from './useFileText';
import { MarkdownBody } from '@/features/markdown/MarkdownBody';
import { renderMarkdownFile } from '@/features/markdown/renderMarkdown';
import { PaneStatusLine } from '@/features/surface-ui/PaneStatusLine';

export function MarkdownPreview({
  owner,
  repo,
  source,
  revision,
}: {
  owner: string;
  repo: string;
  source: FileSource;
  revision: string | null;
}) {
  const { data, error, reload } = useFileText(owner, repo, source.ref, source.path);
  useReloadOnChange(revision, reload);
  if (error) return <PaneStatusLine tone="error" onRetry={reload}>{error}</PaneStatusLine>;
  if (!data) return <PaneStatusLine tone="dim">Loading…</PaneStatusLine>;
  if (data.text === null) return <PaneStatusLine tone="dim">File too large to preview.</PaneStatusLine>;
  return <RenderedMarkdown owner={owner} repo={repo} source={source} text={data.text} />;
}

// A worktree or branch ref changes content under one name, so the route can't tell.
function useReloadOnChange(revision: string | null, reload: () => Promise<unknown>) {
  const seen = useRef(revision);
  useEffect(() => {
    if (seen.current === revision) return;
    seen.current = revision;
    reload().catch(() => {});
  }, [revision, reload]);
}

function RenderedMarkdown({ owner, repo, source, text }: { owner: string; repo: string; source: FileSource; text: string }) {
  const { ref, path } = source;
  const html = useMemo(() => renderMarkdownFile(text, { owner, repo }, ref, path), [text, owner, repo, ref, path]);
  return (
    <div className="px-4 py-3">
      <MarkdownBody className="markdown-body max-w-[720px] break-words text-ink" html={html} tooltipStyle />
    </div>
  );
}
