'use client';

import { useEffect, useState } from 'react';
import { GalleryImage } from './BlobImage';
import { HoverCardTrigger } from '@/features/surface-ui/HoverCard';
import { ImageViewerModal, type ImageSlide } from '@/features/surface-ui/ImageViewerModal';
import { baseName } from './fileTree';
import type { ChangedFile } from './pullRequests';
import type { ImageGallery } from './imageView';

const THUMB = 'flex h-12 w-16 shrink-0 cursor-zoom-in items-center justify-center';

export function ImageThumbnailStrip(gallery: ImageGallery) {
  const { index, setIndex } = useViewerIndex(gallery.baseRef, gallery.headRef);
  return (
    <>
      <ThumbnailRow gallery={gallery} active={index} onOpen={setIndex} />
      {index !== null && <ImageViewerModal slides={gallerySlides(gallery)} index={index} onIndex={setIndex} onClose={() => setIndex(null)} />}
    </>
  );
}

function gallerySlides(gallery: ImageGallery): ImageSlide[] {
  return gallery.files.map((file) => ({
    name: baseName(file.filename),
    detail: file.filename,
    note: file.status,
    image: <GalleryImage gallery={gallery} file={file} />,
  }));
}

function useViewerIndex(baseRef: string, headRef: string) {
  const [index, setIndex] = useState<number | null>(null);
  useEffect(() => setIndex(null), [baseRef, headRef]);
  return { index, setIndex };
}

function ThumbnailRow({
  gallery,
  active,
  onOpen,
}: {
  gallery: ImageGallery;
  active: number | null;
  onOpen: (index: number) => void;
}) {
  return <div className="flex items-center gap-1 overflow-x-auto border-b border-panel-edge px-2 py-1">{thumbButtons(gallery, active, onOpen)}</div>;
}

function thumbButtons(gallery: ImageGallery, active: number | null, onOpen: (index: number) => void) {
  return gallery.files.map((file, index) => (
    <ImageThumb key={file.filename} gallery={gallery} file={file} active={index === active} onOpen={() => onOpen(index)} />
  ));
}

function ImageThumb({
  gallery,
  file,
  active,
  onOpen,
}: {
  gallery: ImageGallery;
  file: ChangedFile;
  active: boolean;
  onOpen: () => void;
}) {
  return (
    <HoverCardTrigger
      label={file.filename}
      serifLabel
      placement="below"
      width="wide"
      interactive={false}
      focusable={false}
      card={<GalleryImage gallery={gallery} file={file} className="max-h-[60vh] object-contain" />}
    >
      <button type="button" aria-label={file.filename} onClick={onOpen} className={thumbClass(active)}>
        <GalleryImage gallery={gallery} file={file} compact className="max-h-12 max-w-16 object-contain" />
      </button>
    </HoverCardTrigger>
  );
}

function thumbClass(active: boolean): string {
  return `${THUMB} ${active ? 'bg-btn-active' : 'hover:bg-btn-hover'}`;
}
