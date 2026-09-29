import * as THREE from 'three';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSelectionController } from '../src/model/ui/selection-controller.js';
import { createModelEditorState } from '../src/model/editor-state.js';

function fixture(t) {
  const previous = globalThis.document;
  const element = () => ({ style: {}, classList: { add() {}, toggle() {} }, setAttribute() {} });
  const button = element();
  globalThis.document = { createElement: element, getElementById: () => button };
  t.after(() => {
    globalThis.document = previous;
  });
  const listeners = {},
    captured = new Set(),
    selected = [];
  const surface = {
    style: {},
    addEventListener: (name, handler) => {
      listeners[name] = handler;
    },
    setPointerCapture: (id) => captured.add(id),
    hasPointerCapture: (id) => captured.has(id),
    releasePointerCapture: (id) => {
      captured.delete(id);
      listeners.lostpointercapture?.({ pointerId: id });
    },
  };
  const rootListeners = {};
  surface.ownerDocument = {
    addEventListener: (name, handler) => {
      rootListeners[name] = handler;
      listeners[name] = handler;
    },
  };
  const host = {
    ...element(),
    clientWidth: 400,
    clientHeight: 400,
    append() {},
    getBoundingClientRect: () => ({ left: 10, top: 20 }),
  };
  const camera = new THREE.OrthographicCamera(-200, 200, 200, -200, 1, 10000);
  camera.position.set(0, 0, 1000);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const project = {
    objects: [{ id: 'line', type: 'helperline', start: [-100, 0, 0], end: [100, 0, 0] }],
  };
  const ui = createModelEditorState();
  let controls = { enabled: true };
  const controller = createSelectionController({
    host,
    renderer: { domElement: surface },
    camera,
    project,
    ui,
    getControls: () => controls,
    setDrawing() {},
    ray() {},
    select: (...args) => selected.push(args),
    selectionHit: () => 'beam',
    setSelection: (ids) => selected.push(ids),
    isVisible: () => true,
  });
  const event = (id = 1) => ({
    pointerId: id,
    clientX: 40,
    clientY: 60,
    shiftKey: true,
    stopImmediatePropagation() {},
  });
  return {
    controller,
    rootListeners,
    ui,
    captured,
    listeners,
    selected,
    event,
    replaceControls: () => {
      controls = { enabled: true };
      return controls;
    },
    getControls: () => controls,
  };
}

test('cancelling captured selection restores camera controls without selecting anything', (t) => {
  const f = fixture(t);
  f.controller.beginBox(f.event());
  assert.equal(f.getControls().enabled, false);
  assert.deepEqual(f.ui.marquee.start, { x: 30, y: 40 });
  f.listeners.pointercancel(f.event());
  assert.equal(f.ui.marquee, null);
  assert.equal(f.getControls().enabled, true);
  assert.equal(f.captured.size, 0);
  assert.deepEqual(f.selected, []);
  f.controller.cancelBox();
});

test('selection click preserves additive selection and ignores another pointer', (t) => {
  const f = fixture(t);
  f.controller.beginBox(f.event());
  f.listeners.pointerup(f.event(2));
  assert.notEqual(f.ui.marquee, null);
  f.listeners.pointerup(f.event());
  assert.deepEqual(f.selected, [['beam', true]]);
  assert.equal(f.ui.marquee, null);
});

test('selection controller follows replaced camera controls after changing workplane view', (t) => {
  const f = fixture(t),
    next = f.replaceControls();
  f.controller.beginBox(f.event());
  assert.equal(next.enabled, false);
  f.controller.cancelBox();
  assert.equal(next.enabled, true);
  assert.equal(f.ui.marquee, null);
});

test('model editors never share mutable selection or placement state', () => {
  const a = createModelEditorState(),
    b = createModelEditorState();
  a.selectedIds.add('beam');
  a.placement.horizontalAlignment = 'right';
  assert.equal(b.selectedIds.size, 0);
  assert.equal(b.placement.horizontalAlignment, 'center');
});

for (const [label, start, end, expected] of [
  ['fast crossing', [230, 230], [190, 210], ['line']],
  ['fast window excludes partial line', [190, 210], [230, 230], []],
  ['fast window includes full line', [90, 200], [330, 240], ['line']],
])
  test(label + ' completes on document release without any move event', (t) => {
    const f = fixture(t);
    f.controller.beginBox({ ...f.event(), clientX: start[0], clientY: start[1], shiftKey: false });
    f.rootListeners.pointerup({ ...f.event(), clientX: end[0], clientY: end[1] });
    assert.deepEqual(f.selected, [expected]);
    assert.equal(f.ui.marquee, null);
    assert.equal(f.getControls().enabled, true);
  });
test('another pointer cancellation cannot discard an active selection', (t) => {
  const f = fixture(t);
  f.controller.beginBox(f.event());
  f.rootListeners.pointercancel(f.event(2));
  assert.notEqual(f.ui.marquee, null);
  f.rootListeners.pointerup(f.event());
  assert.deepEqual(f.selected, [['beam', true]]);
});

test('capture loss between the final move and release does not discard selection', (t) => {
  const f = fixture(t);
  f.controller.beginBox({ ...f.event(), clientX: 230, clientY: 230, shiftKey: false });
  f.rootListeners.pointermove({ ...f.event(), clientX: 190, clientY: 210 });
  f.captured.clear();
  f.listeners.lostpointercapture?.(f.event());
  assert.notEqual(f.ui.marquee, null);
  assert.equal(f.getControls().enabled, false);
  f.rootListeners.pointerup({ ...f.event(), clientX: 190, clientY: 210 });
  assert.deepEqual(f.selected, [['line']]);
  assert.equal(f.ui.marquee, null);
  assert.equal(f.getControls().enabled, true);
  f.listeners.lostpointercapture?.(f.event());
  f.rootListeners.pointerup(f.event());
  assert.equal(f.selected.length, 1);
});
test('explicit cancellation after capture loss still aborts without selecting', (t) => {
  const f = fixture(t);
  f.controller.beginBox(f.event());
  f.captured.clear();
  f.listeners.lostpointercapture?.(f.event());
  f.rootListeners.pointercancel(f.event());
  f.rootListeners.pointerup(f.event());
  assert.deepEqual(f.selected, []);
  assert.equal(f.getControls().enabled, true);
});
