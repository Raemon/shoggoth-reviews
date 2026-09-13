import assert from 'node:assert/strict';
import { bindMapGestures } from '../src/features/codebase-map/mapGestures.ts';

class Canvas extends EventTarget {
  getBoundingClientRect() { return { left: 10, top: 20 }; }
  setPointerCapture() {}
  focus() {}
}

const selectionCases = [
  ['click', [['pointerdown'], ['pointerup']], ['30,30']],
  ['small jitter', [['pointerdown'], ['pointermove', 1, 43], ['pointerup', 1, 43]], ['33,30']],
  ['drag', [['pointerdown'], ['pointermove', 1, 60], ['pointerup', 1, 60]], []],
  ['two stationary fingers', [['pointerdown'], ['pointerdown', 2], ['pointerup'], ['pointerup', 2]], []],
  ['pinch', [['pointerdown'], ['pointerdown', 2, 80], ['pointermove', 2, 100], ['pointerup', 2], ['pointerup']], []],
  ['canceled pointer', [['pointerdown'], ['pointercancel'], ['pointerup']], []],
  ['lost capture', [['pointerdown'], ['lostpointercapture'], ['pointerup']], []],
  ['new click after cancel', [['pointerdown'], ['pointercancel'], ['pointerdown'], ['pointerup']], ['30,30']],
  ['right button', [['pointerdown', 1, 40, 50, 2], ['pointerup', 1, 40, 50, 2]], []],
];
for (const [name, events, expected] of selectionCases) checkSelection(name, events, expected);
checkPinch();
checkNavigation();
checkCleanup();
console.log('Map gesture checks passed: clicks, touch, cancellation, pinch, keyboard, wheel, and cleanup.');

function fixture() {
  const canvas = new Canvas();
  const calls = [];
  const engine = makeEngine(canvas, calls);
  const unbind = bindMapGestures(engine);
  return { canvas, calls, unbind };
}

function makeEngine(canvas, calls) {
  const record = (name) => (...args) => calls.push([name, ...args]);
  return { canvas, viewport: { width: 1000, height: 600 },
    pick: (x, y) => ({ path: `${x},${y}` }), callbacks: { select: (node) => calls.push(['select', node.path]) },
    point: record('point'), clearHover: record('clearHover'), pan: record('pan'), zoom: record('zoom'), fit: record('fit') };
}

function emit(canvas, type, properties = {}) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, properties);
  canvas.dispatchEvent(event);
  return event;
}

function pointer(canvas, [type, pointerId = 1, clientX = 40, clientY = 50, button = 0]) {
  return emit(canvas, type, { pointerId, clientX, clientY, button });
}

function checkSelection(name, events, expected) {
  const { canvas, calls, unbind } = fixture();
  for (const event of events) pointer(canvas, event);
  assert.deepEqual(calls.filter(([type]) => type === 'select').map(([, path]) => path), expected, name);
  unbind();
}

function checkPinch() {
  const { canvas, calls, unbind } = fixture();
  for (const event of [['pointerdown'], ['pointerdown', 2, 80], ['pointermove', 2, 120]]) pointer(canvas, event);
  assert.deepEqual(calls, [['zoom', 2, 50, 30], ['pan', 20, 0]], 'pinch scales around the old center and follows the new center');
  unbind();
}

function checkNavigation() {
  const { canvas, calls, unbind } = fixture();
  assert.equal(emit(canvas, 'keydown', { key: 'ArrowLeft' }).defaultPrevented, true);
  assert.equal(emit(canvas, 'keydown', { key: 'ArrowLeft', metaKey: true }).defaultPrevented, false);
  assert.deepEqual(calls, [['pan', 80, 0]], 'browser shortcuts remain available');
  checkWheel(canvas, calls);
  unbind();
}

function checkWheel(canvas, calls) {
  const wheel = emit(canvas, 'wheel', { clientX: 40, clientY: 50, deltaY: 1, deltaMode: 1 });
  assert.equal(wheel.defaultPrevented, true);
  assert.deepEqual(calls.at(-1), ['zoom', Math.exp(-16 * 0.008), 30, 30], 'wheel zoom respects local position and line units');
}

function checkCleanup() {
  const { canvas, calls, unbind } = fixture();
  emit(canvas, 'pointerleave');
  unbind();
  for (const event of [['pointerdown'], ['pointermove'], ['pointerup']]) pointer(canvas, event);
  for (const type of ['pointerleave', 'wheel', 'dblclick', 'keydown']) emit(canvas, type, { key: 'Home' });
  assert.deepEqual(calls, [['clearHover']], 'hover clears on leave and listeners detach on destruction');
}
