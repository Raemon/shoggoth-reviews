import { fitCamera, zoomCamera, type Camera, type Viewport } from './mapCamera';
import { hitNode, type MapNode, type Rect } from './mapLayout';
import { paintMap, paintMinimap, type MapScene } from './mapRenderer';
import { bindMapGestures } from './mapGestures';

export interface MapCallbacks { select: (node: MapNode) => void; zoom: (percent: number) => void; hover: (path: string) => void }

export class MapEngine {
  camera: Camera = { x: 0, y: 0, scale: 1 };
  viewport: Viewport = { width: 1, height: 1 };
  hover: string | null = null;
  private frame = 0;
  private animation: { from: Camera; to: Camera; start: number } | null = null;
  private observer: ResizeObserver;
  private unbind: () => void;

  constructor(readonly canvas: HTMLCanvasElement, readonly mini: HTMLCanvasElement, public scene: MapScene, readonly callbacks: MapCallbacks) {
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.unbind = bindMapGestures(this);
  }

  update(scene: MapScene): void {
    this.scene = scene;
    this.requestDraw();
  }

  destroy(): void {
    this.observer.disconnect();
    this.unbind();
    cancelAnimationFrame(this.frame);
  }

  fit(rect: Rect = this.scene.root): void {
    this.animateTo(fitCamera(rect, this.viewport));
  }

  zoom(factor: number, x = this.viewport.width / 2, y = this.viewport.height / 2): void {
    this.animation = null;
    this.camera = zoomCamera(this.camera, factor, x, y);
    this.requestDraw();
  }

  pan(dx: number, dy: number): void {
    this.animation = null;
    this.camera = { ...this.camera, x: this.camera.x + dx, y: this.camera.y + dy };
    this.requestDraw();
  }

  pick(x: number, y: number): MapNode | null {
    return hitNode(this.scene.root, (x - this.camera.x) / this.camera.scale, (y - this.camera.y) / this.camera.scale, this.camera.scale);
  }

  point(x: number, y: number): void {
    const path = this.pick(x, y)?.path ?? null;
    if (this.hover === path) return;
    this.hover = path;
    this.callbacks.hover(path ?? '');
    this.requestDraw();
  }

  clearHover(): void {
    if (this.hover === null) return;
    this.hover = null;
    this.callbacks.hover('');
    this.requestDraw();
  }

  requestDraw(): void {
    if (!this.frame) this.frame = requestAnimationFrame((time) => this.draw(time));
  }

  private resize(): void {
    const { width, height } = this.canvas.getBoundingClientRect();
    const first = this.viewport.width === 1;
    this.viewport = { width, height };
    this.sizeCanvas(width, height);
    if (first) this.camera = fitCamera(this.scene.root, this.viewport);
    this.requestDraw();
  }

  private sizeCanvas(width: number, height: number): void {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.canvas.getContext('2d')?.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  private animateTo(to: Camera): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) this.camera = to;
    else this.animation = { from: { ...this.camera }, to, start: performance.now() };
    this.requestDraw();
  }

  private draw(time: number): void {
    this.frame = 0;
    this.advanceAnimation(time);
    const ctx = this.canvas.getContext('2d');
    if (ctx) paintMap(ctx, this.scene, { camera: this.camera, viewport: this.viewport, hover: this.hover });
    const mini = this.mini.getContext('2d');
    if (mini) paintMinimap(mini, this.scene.root, this.camera, this.viewport);
    this.callbacks.zoom(Math.round(this.camera.scale / fitCamera(this.scene.root, this.viewport).scale * 100));
  }

  private advanceAnimation(time: number): void {
    if (!this.animation) return;
    const { from, to, start } = this.animation;
    const t = Math.min(1, (time - start) / 240);
    this.camera = interpolateCamera(from, to, 1 - (1 - t) ** 3);
    if (t === 1) this.animation = null;
    else this.requestDraw();
  }
}

function interpolateCamera(from: Camera, to: Camera, t: number): Camera {
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, scale: from.scale + (to.scale - from.scale) * t };
}
