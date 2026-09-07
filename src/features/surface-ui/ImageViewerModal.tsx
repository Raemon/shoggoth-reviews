'use client';

import { createPortal } from 'react-dom';
import type { ReactNode, RefObject } from 'react';
import { useFocusOnIndex, useViewerKeys, wrapImageIndex } from './viewerKeys';
import { TEXT_ACTION } from './buttonStyles';
import { HoverCardTrigger } from './HoverCard';

export interface ImageSlide {
  name: string;
  detail: string;
  note?: string;
  image: ReactNode;
}

const BACKDROP = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 outline-none';
const PANEL = 'relative flex h-[92vh] w-[92vw] flex-col rounded-lg border border-panel-edge bg-panel shadow-card';
const STAGE = 'flex min-h-0 flex-1 items-center-safe justify-center overflow-y-auto px-14 pb-4';
const FRAME = 'flex max-h-full min-h-0 max-w-full [&_img]:max-h-full [&_img]:max-w-full [&_img]:object-contain';
const SHIFT =
  'absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-panel-edge bg-panel text-[24px] leading-none text-ink-dim shadow-card hover:bg-btn-hover hover:text-ink';

interface ViewerProps {
  slides: ImageSlide[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}

export function ImageViewerModal(props: ViewerProps) {
  const slide = props.slides[props.index];
  useViewerKeys(props.index, props.slides.length, props.onIndex, props.onClose);
  if (!slide) return null;
  return createPortal(<ViewerDialog {...props} slide={slide} />, document.body);
}

function ViewerDialog({ slides, slide, index, onIndex, onClose }: ViewerProps & { slide: ImageSlide }) {
  const dialog = useFocusOnIndex(index);
  const shift = (delta: number) => <ShiftButton delta={delta} index={index} count={slides.length} onIndex={onIndex} />;
  return (
    <Backdrop dialog={dialog} label={slide.detail} onClose={onClose}>
      <div onClick={(event) => event.stopPropagation()} className={PANEL}>
        <ViewerCaption slide={slide} index={index} count={slides.length} onClose={onClose} />
        <div className={STAGE}>
          <span className={FRAME}>{slide.image}</span>
        </div>
        {slides.length > 1 && (
          <>
            {shift(-1)}
            {shift(1)}
          </>
        )}
      </div>
    </Backdrop>
  );
}

function Backdrop({
  dialog,
  label,
  onClose,
  children,
}: {
  dialog: RefObject<HTMLDivElement | null>;
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div ref={dialog} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onClick={onClose} className={BACKDROP}>
      {children}
    </div>
  );
}

function ViewerCaption({ slide, index, count, onClose }: { slide: ImageSlide; index: number; count: number; onClose: () => void }) {
  return (
    <div className="flex shrink-0 items-baseline gap-2 border-b border-panel-edge px-3 py-1.5 text-[11px] leading-4">
      <CaptionName name={slide.name} detail={slide.detail} />
      {slide.note && <span className="shrink-0 uppercase tracking-[0.18em] text-ink-dim">{slide.note}</span>}
      <CaptionIndex index={index} count={count} />
      <CloseViewer onClose={onClose} />
    </div>
  );
}

function CaptionName({ name, detail }: { name: string; detail: string }) {
  return (
    <HoverCardTrigger label={detail} serifLabel className="min-w-0 flex-1" focusable={false} tooltipStyle>
      <span className="filename-text truncate text-ink">{name}</span>
    </HoverCardTrigger>
  );
}

function CaptionIndex({ index, count }: { index: number; count: number }) {
  return (
    <span className="shrink-0 text-ink-dim">
      {index + 1}/{count}
    </span>
  );
}

function CloseViewer({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" onClick={onClose} className={`${TEXT_ACTION} shrink-0 px-1`}>
      close
    </button>
  );
}

function ShiftButton({ delta, index, count, onIndex }: { delta: number; index: number; count: number; onIndex: (index: number) => void }) {
  const back = delta < 0;
  return (
    <button
      type="button"
      aria-label={back ? 'Previous image' : 'Next image'}
      onClick={() => onIndex(wrapImageIndex(index, delta, count))}
      className={`${SHIFT} ${back ? 'left-3' : 'right-3'}`}
    >
      {back ? '‹' : '›'}
    </button>
  );
}
