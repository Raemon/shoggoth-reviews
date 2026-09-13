'use client';

import { useRouter } from 'next/navigation';
import { useState, type MouseEvent } from 'react';
import { HoverCardHtml } from '@/features/surface-ui/HoverCard';
import { ImageViewerModal, type ImageSlide } from '@/features/surface-ui/ImageViewerModal';

interface OpenGallery {
  slides: ImageSlide[];
  index: number;
}

export function MarkdownBody({ html, className, tooltipStyle = false }: { html: string; className: string; tooltipStyle?: boolean }) {
  const [open, setOpen] = useState<OpenGallery | null>(null);
  const router = useRouter();
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const gallery = galleryUnderClick(event);
    if (gallery) return setOpen(gallery);
    navigateUnderClick(event, router);
  };
  return (
    <div onClick={handleClick}>
      <HoverCardHtml html={html} className={className} tooltipStyle={tooltipStyle} />
      <Gallery open={open} onOpen={setOpen} />
    </div>
  );
}

function Gallery({ open, onOpen }: { open: OpenGallery | null; onOpen: (open: OpenGallery | null) => void }) {
  if (!open) return null;
  return (
    <ImageViewerModal
      slides={open.slides}
      index={open.index}
      onIndex={(index) => onOpen({ slides: open.slides, index })}
      onClose={() => onOpen(null)}
    />
  );
}

function navigateUnderClick(event: MouseEvent<HTMLDivElement>, router: { push: (route: string) => void }): boolean {
  const route = routeUnderClick(event);
  if (route === null) return false;
  event.preventDefault();
  router.push(route);
  return true;
}

function routeUnderClick(event: MouseEvent<HTMLDivElement>): string | null {
  if (isModifiedClick(event)) return null;
  const href = clickedAncestor(event, 'a')?.getAttribute('href') ?? null;
  return href?.startsWith('/') && !href.startsWith('//') ? href : null;
}

function clickedAncestor<E extends Element>(event: MouseEvent<HTMLDivElement>, selector: string): E | null {
  return event.target instanceof Element ? event.target.closest<E>(selector) : null;
}

function isModifiedClick(event: MouseEvent<HTMLDivElement>): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function galleryUnderClick(event: MouseEvent<HTMLDivElement>): OpenGallery | null {
  if (isModifiedClick(event)) return null;
  const clicked = clickedAncestor<HTMLImageElement>(event, 'img');
  const images = clicked ? [...event.currentTarget.querySelectorAll('img')] : [];
  const index = clicked ? images.indexOf(clicked) : -1;
  if (index < 0) return null;
  event.preventDefault();
  return { slides: images.map(imageSlide), index };
}

function imageSlide(image: HTMLImageElement): ImageSlide {
  const src = image.currentSrc || image.src;
  return {
    name: image.alt || sourceName(src),
    detail: src,
    // eslint-disable-next-line @next/next/no-img-element
    image: <img src={src} alt={image.alt} />,
  };
}

function sourceName(src: string): string {
  return src.split(/[?#]/)[0]?.split('/').pop() || src;
}
