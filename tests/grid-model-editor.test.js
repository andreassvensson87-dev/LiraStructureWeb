import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createGridModelEditor } from '../src/app/grid-model-editor.js';

function fixture(t) {
  const oldDocument = globalThis.document,
    oldWindow = globalThis.window;
  const docEvents = {},
    hostEvents = {},
    fields = new Map();
  function element() {
    return {
      dataset: {},
      style: {},
      inert: false,
      disabled: false,
      value: '',
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener() {},
      setAttribute() {},
      prepend() {},
      append() {},
      contains: () => false,
      querySelector(selector) {
        if (!fields.has(selector)) fields.set(selector, element());
        return fields.get(selector);
      },
      matches: () => false,
      closest() {
        return this;
      },
    };
  }
  const lock = element();
  globalThis.document = {
    createElement: element,
    getElementById: element,
    querySelectorAll: () => [lock],
    addEventListener: (key, cb) => {
      docEvents[key] = cb;
    },
  };
  globalThis.window = { addEventListener() {} };
  t.after(() => {
    globalThis.document = oldDocument;
    globalThis.window = oldWindow;
  });
  const host = {
    ...element(),
    clientWidth: 1000,
    clientHeight: 1000,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 1000 }),
    addEventListener: (key, cb) => {
      hostEvents[key] = cb;
    },
    setPointerCapture() {},
    hasPointerCapture: () => true,
    releasePointerCapture() {},
  };
  const project = {
    grid: { x: [0, 3000, 6000], y: [0, 4000, 8000] },
    snap: { gridStep: 100 },
    objects: [{ id: 'physical' }],
  };
  const scene = new THREE.Scene(),
    group = new THREE.Group();
  scene.add(group);
  const overlay = { ...element(), contains: (el) => !!el.dataset.gridId };
  const grid = {
    group,
    overlay,
    labels: [],
    highlight() {},
    set(data) {
      group.clear();
      for (const axis of ['x', 'y'])
        data[axis].forEach((position, index) => {
          const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(
                axis === 'x' ? position : -1000,
                axis === 'y' ? position : -1000,
                0,
              ),
              new THREE.Vector3(
                axis === 'x' ? position : 10000,
                axis === 'y' ? position : 10000,
                0,
              ),
            ]),
            new THREE.LineBasicMaterial(),
          );
          line.userData.gridId = `${axis}:${index}`;
          group.add(line);
        });
    },
  };
  const camera = new THREE.OrthographicCamera(-10000, 10000, 10000, -10000, 0.1, 50000);
  camera.position.set(0, 0, 10000);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const controls = { enabled: true };
  let checkpoints = 0,
    changes = 0,
    stopped = 0,
    prevented = 0;
  const editor = createGridModelEditor({
    host,
    camera,
    grid,
    project,
    getControls: () => controls,
    elevation: () => 0,
    begin() {},
    checkpoint: () => checkpoints++,
    changed: () => changes++,
    invalidate() {},
    status() {},
    undo() {},
  });
  const event = (overrides = {}) => ({
    button: 0,
    buttons: 1,
    pointerId: 1,
    clientX: 500,
    clientY: 500,
    target: { ...element(), dataset: { gridId: 'x:1' } },
    preventDefault: () => prevented++,
    stopImmediatePropagation: () => stopped++,
    stopPropagation() {},
    ...overrides,
  });
  return {
    editor,
    fields,
    controls,
    project,
    lock,
    hostEvents,
    docEvents,
    event,
    counts: () => ({ checkpoints, changes, stopped, prevented }),
  };
}

test('grid gestures never intercept ordinary model editing until the explicit mode is active', (t) => {
  const f = fixture(t);
  f.hostEvents.pointerdown(f.event());
  assert.deepEqual(f.counts(), { checkpoints: 0, changes: 0, stopped: 0, prevented: 0 });
  assert.equal(f.lock.inert, false);
  f.editor.start();
  assert.equal(f.lock.inert, true);
  f.editor.finish();
  assert.equal(f.lock.inert, false);
  assert.equal(f.editor.active, false);
});
test('drag previews leave project data unchanged and Escape cancels before leaving the mode', (t) => {
  const f = fixture(t),
    before = structuredClone(f.project);
  f.editor.start();
  f.hostEvents.pointerdown(f.event());
  assert.equal(f.controls.enabled, false);
  f.hostEvents.pointermove(f.event({ clientX: 550 }));
  assert.deepEqual(f.project, before);
  assert.equal(f.fields.get('[data-position]').value, 4000);
  f.docEvents.keydown(f.event({ key: 'Escape' }));
  assert.equal(f.editor.active, true);
  assert.equal(f.controls.enabled, true);
  assert.deepEqual(f.project, before);
  assert.equal(f.counts().checkpoints, 0);
  f.docEvents.keydown(f.event({ key: 'Escape' }));
  assert.equal(f.editor.active, false);
});
test('release commits one undo checkpoint and changes only the selected grid coordinate', (t) => {
  const f = fixture(t),
    objects = structuredClone(f.project.objects);
  f.editor.start();
  f.hostEvents.pointerdown(f.event());
  f.hostEvents.pointermove(f.event({ clientX: 550 }));
  f.hostEvents.pointerup(f.event({ clientX: 550 }));
  assert.deepEqual(f.project.grid.x, [0, 4000, 6000]);
  assert.deepEqual(f.project.grid.labels.x, ['1', '2', '3']);
  assert.deepEqual(f.project.objects, objects);
  assert.equal(f.counts().checkpoints, 1);
  assert.equal(f.counts().changes, 1);
  assert.equal(f.controls.enabled, true);
});
test('pointer cancellation discards a preview and preserves a previously disabled camera', (t) => {
  const f = fixture(t),
    before = structuredClone(f.project);
  f.controls.enabled = false;
  f.editor.start();
  f.hostEvents.pointerdown(f.event());
  f.hostEvents.pointermove(f.event({ clientX: 560 }));
  f.hostEvents.pointercancel(f.event());
  assert.deepEqual(f.project, before);
  assert.equal(f.controls.enabled, false);
  assert.equal(f.counts().checkpoints, 0);
});
