'use client';

import type { ReactEventHandler } from 'react';
import type { ChangedFile } from './pullRequests';
import type { ImageFileView, ImageGallery, ImageSource } from './imageView';
import { previewSource } from './imageView';
import { useFileBlob } from './useFileBlob';
import { PaneStatusLine } from '@/features/surface-ui/PaneStatusLine';

export const CHECKERBOARD = {
  backgroundImage:
    'linear-gradient(45deg, var(--color-checker) 25%, transparent 25%), linear-gradient(-45deg, var(--color-checker) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--color-checker) 75%), linear-gradient(-45deg, transparent 75%, var(--color-checker) 75%)',
  backgroundSize: '12px 12px',
  backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0',
};

export function FilePreview({ className, compact = false, ...view }: ImageFileView & { className: string; compact?: boolean }) {
  const source = previewSource(view.file, view.baseRef, view.headRef);
  return <BlobImage key={`${source.ref}:${source.path}`} owner={view.owner} repo={view.repo} source={source} alt={view.file.filename} compact={compact} className={className} />;
}

export function GalleryImage({ gallery, file, className = '', compact = false }: { gallery: ImageGallery; file: ChangedFile; className?: string; compact?: boolean }) {
  return <FilePreview owner={gallery.owner} repo={gallery.repo} file={file} baseRef={gallery.baseRef} headRef={gallery.headRef} compact={compact} className={className} />;
}

export function BlobImage({
  owner,
  repo,
  source,
  alt,
  className,
  compact = false,
}: {
  owner: string;
  repo: string;
  source: ImageSource;
  alt: string;
  className: string;
  compact?: boolean;
}) {
  const blob = useFileBlob(owner, repo, source);
  if (!blob.value?.dataUrl)
    return (
      <PaneStatusLine tone={blob.error ? 'error' : 'dim'} className="text-center">
        {blobStatus(blob, compact)}
      </PaneStatusLine>
    );
  return <CheckerImg src={blob.value.dataUrl} alt={alt} className={className} />;
}

export function CheckerImg({
  src,
  alt,
  className,
  onLoad,
}: {
  src: string;
  alt: string;
  className: string;
  onLoad?: ReactEventHandler<HTMLImageElement>;
}) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} style={CHECKERBOARD} className={className} onLoad={onLoad} />
    </>
  );
}

function blobStatus(blob: ReturnType<typeof useFileBlob>, compact: boolean): string {
  if (blob.error) return compact ? 'Failed' : blob.error;
  if (!blob.value) return 'Loading…';
  return compact ? 'Too big' : 'Too large to preview.';
}
