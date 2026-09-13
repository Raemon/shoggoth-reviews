import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import './codeMapTestLoader.mjs';
import { buildMap, contains, hitNode, WORLD } from '../src/features/codebase-map/mapLayout.ts';
import { fitCamera, screenRect, zoomCamera } from '../src/features/codebase-map/mapCamera.ts';

const { sourceFileSet } = await import('../src/features/codebase-map/mapFiles.ts');
const mixed = { sha: 'mixed', files: ['src/main.ts', 'photo.PNG', 'font.woff2', 'README.md'], truncated: false };
assert.deepEqual(sourceFileSet(mixed, false).files, ['src/main.ts', 'README.md']);
assert.equal(sourceFileSet(mixed, true), mixed);
const { paintMap, paintMinimap } = await import('../src/features/codebase-map/mapRenderer.ts');
const files = ['__proto__/constructor.ts', 'src/main.ts', 'src/lib/math.ts', 'empty.txt', 'image.png'];
const layout = buildMap({ sha: 'test', files, sizes: { 'empty.txt': 0, 'image.png': 20_000_000 }, truncated: false });
assert.equal(layout.root.count, files.length);
assert.equal(layout.byPath.size, 9);
assert.equal(layout.byPath.get('__proto__/constructor.ts').directory, false);
assert.equal(layout.root.bytes, 20_003_072);
assert.deepEqual(buildMap({ sha: 'empty', files: [], truncated: false }).files, []);
assert.deepEqual(layout.files.map(({ path, x, y, width, height }) => ({ path, x, y, width, height })),
  buildMap({ sha: 'test', files: [...files].reverse(), sizes: { 'empty.txt': 0, 'image.png': 20_000_000 }, truncated: false })
    .files.reverse().map(({ path, x, y, width, height }) => ({ path, x, y, width, height })));
checkTree(layout.root);
for (const node of layout.files) assert.equal(hitNode(layout.root, node.x + node.width / 2, node.y + node.height / 2)?.path, node.path);
assert.equal(hitNode(layout.root, -1, -1), null);

const viewport = { width: 1200, height: 800 };
const camera = fitCamera(WORLD, viewport);
const fit = screenRect(WORLD, camera);
assert.ok(fit.x >= 0 && fit.y >= 0 && fit.x + fit.width <= viewport.width && fit.y + fit.height <= viewport.height);
const anchor = { x: 413, y: 271 };
const zoomed = zoomCamera(camera, 2.7, anchor.x, anchor.y);
assert.ok(Math.abs((anchor.x - camera.x) / camera.scale - (anchor.x - zoomed.x) / zoomed.scale) < 1e-8);
assert.ok(Math.abs((anchor.y - camera.y) / camera.scale - (anchor.y - zoomed.y) / zoomed.scale) < 1e-8);
assert.ok(Number.isFinite(zoomCamera(camera, 1e20, 0, 0).scale));

const many = Array.from({ length: 50_000 }, (_, i) => `packages/p${i % 80}/src/group${i % 13}/file${i}.ts`);
const start = performance.now();
const large = buildMap({ sha: 'large', files: many, truncated: true });
assert.equal(large.root.count, many.length);
checkTree(large.root);
for (let i = 0; i < many.length; i += 137) {
  const node = large.byPath.get(many[i]);
  assert.equal(hitNode(large.root, node.x + node.width / 2, node.y + node.height / 2)?.path, node.path);
}
const flat = buildMap({ sha: 'flat', files: Array.from({ length: 100_000 }, (_, i) => `file${i}.ts`), truncated: true });
const overview = fitCamera(flat.root, viewport);
const target = flat.files.at(-1);
const point = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
assert.equal(hitNode(flat.root, point.x, point.y, overview.scale), flat.root);
const focused = fitCamera(target, viewport);
assert.equal(hitNode(flat.root, point.x, point.y, focused.scale), target);
const overviewDraws = countDraws(flat.root, overview);
const focusedDraws = countDraws(flat.root, focused);
assert.ok(overviewDraws < 20_000, `${overviewDraws} overview draws exceed the viewport detail budget`);
assert.ok(focusedDraws < 300, `${focusedDraws} focused draws should prune offscreen partitions`);
const mini = canvasCounter();
paintMinimap(mini.context, flat.root, overview, viewport);
assert.ok(mini.draws < 500, `${mini.draws} minimap draws should aggregate small partitions`);
console.log(`Code map checks passed: 50k nested + 100k flat files, ${overviewDraws} overview/${focusedDraws} focused/${mini.draws} minimap draws (${Math.round(performance.now() - start)} ms).`);

function countDraws(root, camera) {
  const canvas = canvasCounter();
  paintMap(canvas.context, { root, selected: null, query: '', expanded: new Map() }, { camera, viewport, hover: null });
  return canvas.draws;
}

function canvasCounter() {
  const canvas = { draws: 0, context: null };
  canvas.context = new Proxy({}, { set: () => true, get: () => () => { canvas.draws++; } });
  return canvas;
}

function checkTree(node) {
  assert.ok([node.x, node.y, node.width, node.height].every(Number.isFinite));
  assert.ok(node.width > 0 && node.height > 0);
  for (const child of node.children) {
    assert.ok(contains(node, child.x, child.y));
    assert.ok(child.x + child.width <= node.x + node.width + 1e-8);
    assert.ok(child.y + child.height <= node.y + node.height + 1e-8);
    checkTree(child);
  }
}
