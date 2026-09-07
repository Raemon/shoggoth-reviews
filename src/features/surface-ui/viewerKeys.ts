'use client';

import { useEffect, useRef } from 'react';

export function wrapImageIndex(index: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return ((index + delta) % count + count) % count;
}

export function useViewerKeys(
  index: number,
  count: number,
  onIndex: (index: number) => void,
  onClose: () => void,
) {
  useEffect(() => listenViewerKeys(index, count, onIndex, onClose), [index, count, onIndex, onClose]);
}

function listenViewerKeys(
  index: number,
  count: number,
  onIndex: (index: number) => void,
  onClose: () => void,
) {
  const onKey = (event: KeyboardEvent) => applyViewerKey(event, index, count, onIndex, onClose);
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}

function applyViewerKey(
  event: KeyboardEvent,
  index: number,
  count: number,
  onIndex: (index: number) => void,
  onClose: () => void,
) {
  const action = viewerKeyAction(event.key, index, count);
  if (action === null) return;
  event.preventDefault();
  if (action === 'close') onClose();
  else onIndex(action);
}

function viewerKeyAction(key: string, index: number, count: number): number | 'close' | null {
  if (key === 'Escape') return 'close';
  if (key === 'ArrowLeft') return wrapImageIndex(index, -1, count);
  if (key === 'ArrowRight') return wrapImageIndex(index, 1, count);
  return null;
}

export function useFocusOnIndex(index: number) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialog.current?.focus();
  }, [index]);
  return dialog;
}
