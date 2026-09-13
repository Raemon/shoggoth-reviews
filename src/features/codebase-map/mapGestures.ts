import type { MapEngine } from './mapEngine';

type Point = { x: number; y: number };
type Pointer = Point & { start: Point };

export function bindMapGestures(engine: MapEngine): () => void {
  const controller = new AbortController();
  bindPointerEvents(engine.canvas, new PointerGestures(engine), controller.signal);
  bindNavigationEvents(engine, controller.signal);
  return () => controller.abort();
}

class PointerGestures {
  private pointers = new Map<number, Pointer>();
  private moved = false;
  private engine: MapEngine;

  constructor(engine: MapEngine) { this.engine = engine; }

  down(event: PointerEvent): void {
    if (event.button !== 0) return;
    const point = localPoint(this.engine.canvas, event);
    this.moved = this.pointers.size > 0;
    this.pointers.set(event.pointerId, { ...point, start: point });
    capturePointer(this.engine.canvas, event.pointerId);
  }

  move(event: PointerEvent): void {
    const point = localPoint(this.engine.canvas, event);
    const previous = this.pointers.get(event.pointerId);
    if (!previous) return this.engine.point(point.x, point.y);
    this.moved ||= distance(previous.start, point) > 4;
    if (this.moved) moveCamera(this.engine, this.pointers, event.pointerId, previous, point);
    this.pointers.set(event.pointerId, { ...previous, ...point });
  }

  end(event: PointerEvent): void {
    if (!this.pointers.delete(event.pointerId)) return;
    this.moved ||= event.type !== 'pointerup';
    if (!this.moved && !this.pointers.size) selectAt(this.engine, localPoint(this.engine.canvas, event));
  }
}

function bindPointerEvents(canvas: HTMLCanvasElement, gestures: PointerGestures, signal: AbortSignal): void {
  canvas.addEventListener('pointerdown', (event) => gestures.down(event), { signal });
  canvas.addEventListener('pointermove', (event) => gestures.move(event), { signal });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    canvas.addEventListener(type, (event) => gestures.end(event), { signal });
  }
}

function bindNavigationEvents(engine: MapEngine, signal: AbortSignal): void {
  const options = { signal };
  engine.canvas.addEventListener('wheel', (event) => wheelCamera(engine, event), { ...options, passive: false });
  engine.canvas.addEventListener('dblclick', (event) => focusAt(engine, localPoint(engine.canvas, event)), options);
  engine.canvas.addEventListener('keydown', (event) => keyCamera(engine, event), options);
  engine.canvas.addEventListener('pointerleave', () => engine.clearHover(), options);
}

function capturePointer(canvas: HTMLCanvasElement, id: number): void {
  canvas.setPointerCapture(id);
  canvas.focus({ preventScroll: true });
}

function localPoint(canvas: HTMLCanvasElement, event: MouseEvent): Point {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function moveCamera(engine: MapEngine, pointers: Map<number, Pointer>, id: number, previous: Point, point: Point): void {
  const other = [...pointers].find(([key]) => key !== id)?.[1];
  if (!other) return engine.pan(point.x - previous.x, point.y - previous.y);
  engine.zoom(distance(point, other) / Math.max(1, distance(previous, other)), (previous.x + other.x) / 2, (previous.y + other.y) / 2);
  engine.pan((point.x - previous.x) / 2, (point.y - previous.y) / 2);
}

function selectAt(engine: MapEngine, point: Point): void {
  const node = engine.pick(point.x, point.y);
  if (node) engine.callbacks.select(node);
}

function focusAt(engine: MapEngine, point: Point): void {
  const node = engine.pick(point.x, point.y);
  if (node) engine.fit(node);
}

function wheelCamera(engine: MapEngine, event: WheelEvent): void {
  event.preventDefault();
  if (event.shiftKey) return engine.pan(-event.deltaX, -event.deltaY);
  const point = localPoint(engine.canvas, event);
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? engine.viewport.height : 1);
  engine.zoom(Math.exp(-Math.max(-150, Math.min(150, delta)) * 0.008), point.x, point.y);
}

function keyCamera(engine: MapEngine, event: KeyboardEvent): void {
  const action = cameraKeys(engine)[event.key];
  if (!action || event.metaKey || event.ctrlKey || event.altKey) return;
  event.preventDefault();
  event.stopPropagation();
  action();
}

function cameraKeys(engine: MapEngine): Record<string, () => void> {
  return { '+': () => engine.zoom(1.4), '=': () => engine.zoom(1.4), '-': () => engine.zoom(1 / 1.4),
    '0': () => engine.fit(), Home: () => engine.fit(), Escape: () => engine.fit(),
    ArrowLeft: () => engine.pan(80, 0), ArrowRight: () => engine.pan(-80, 0),
    ArrowUp: () => engine.pan(0, 80), ArrowDown: () => engine.pan(0, -80) };
}
