'use client';

import { useMemo } from 'react';
import { fileTextPath } from './pullPaths';
import type { FileText } from './pullRequests';
import { MarkdownBody } from '@/features/markdown/MarkdownBody';
import { renderMarkdownFile, type MarkdownFile } from '@/features/markdown/renderMarkdown';
import { useGithubToken, useStoreReady } from '@/features/sources/sourceStore';
import { useCachedJson } from '@/features/sources/useCachedJson';
import { PaneStatusLine } from '@/features/surface-ui/PaneStatusLine';

export function MarkdownPreview({ owner, repo, file }: { owner: string; repo: string; file: MarkdownFile }) {
  const ready = useStoreReady();
  const token = useGithubToken();
  const route = fileTextPath(owner, repo, file.ref, file.path);
  const { data, error, reload } = useCachedJson<FileText>(route, token, ready);
  if (error) return <PaneStatusLine tone="error" onRetry={reload}>{error}</PaneStatusLine>;
  if (!data) return <PaneStatusLine tone="dim">Loading…</PaneStatusLine>;
  if (data.text === null) return <PaneStatusLine tone="dim">File too large to preview.</PaneStatusLine>;
  return <RenderedMarkdown owner={owner} repo={repo} file={file} text={data.text} />;
}

function RenderedMarkdown({ owner, repo, file, text }: { owner: string; repo: string; file: MarkdownFile; text: string }) {
  const { ref, path } = file;
  const html = useMemo(() => renderMarkdownFile(text, { owner, repo }, { ref, path }), [text, owner, repo, ref, path]);
  return (
    <div className="px-4 py-3">
      <MarkdownBody className="markdown-body max-w-[720px] break-words text-ink" html={html} tooltipStyle />
    </div>
  );
}
