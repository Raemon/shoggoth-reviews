import type { Rect } from './mapLayout';

export interface Camera { x: number; y: number; scale: number }
export interface Viewport { width: number; height: number }
export const MIN_SCALE = 0.025;
export const MAX_SCALE = 512;

export function fitCamera(rect: Rect, viewport: Viewport): Camera {
  const scale = clampScale(Math.min((viewport.width - 48) / rect.width, (viewport.height - 48) / rect.height));
  return { scale, x: viewport.width / 2 - (rect.x + rect.width / 2) * scale, y: viewport.height / 2 - (rect.y + rect.height / 2) * scale };
}

export function zoomCamera(camera: Camera, factor: number, x: number, y: number): Camera {
  const scale = clampScale(camera.scale * factor);
  const ratio = scale / camera.scale;
  return { scale, x: x - (x - camera.x) * ratio, y: y - (y - camera.y) * ratio };
}

export function screenRect(rect: Rect, camera: Camera): Rect {
  return { x: rect.x * camera.scale + camera.x, y: rect.y * camera.scale + camera.y, width: rect.width * camera.scale, height: rect.height * camera.scale };
}

export function visibleRect(rect: Rect, viewport: Viewport): boolean {
  return rect.x < viewport.width && rect.y < viewport.height && rect.x + rect.width > 0 && rect.y + rect.height > 0;
}

function clampScale(scale: number): number {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
}
