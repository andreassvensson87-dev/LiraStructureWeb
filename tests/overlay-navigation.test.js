import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { installOverlayNavigation } from '../src/model/overlay-navigation.js';
import { installModelPointer } from '../src/model/pointer-controller.js';

function fixture(mode) {
  let captured = null;
  const captures = new Map();
  const root = new EventTarget();
  class Pointer extends Event {
    constructor(type, init) {
      super(type, { cancelable: true });
      for (const [key, value] of Object.entries(init))
        if (!['bubbles', 'cancelable'].includes(key)) this[key] = value;
    }
  }
  const host = {
    addEventListener(type, listener, capturePhase) {
      assert.equal(capturePhase, true);
      captures.set(type, listener);
    },
    removeEventListener(type) {
      captures.delete(type);
    },
  };
  class Canvas extends EventTarget {
    style = {};
    clientWidth = 800;
    clientHeight = 600;
    ownerDocument = { defaultView: { PointerEvent: Pointer, MouseEvent: Pointer } };
    getRootNode() {
      return root;
    }
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 800, height: 600 };
    }
    setPointerCapture(id) {
      captured = id;
    }
    releasePointerCapture(id) {
      assert.equal(id, captured);
      captured = null;
    }
    dispatchEvent(event) {
      Object.defineProperty(event, 'target', { value: this, configurable: true });
      captures.get(event.type)?.(event);
      return event.cancelBubble ? false : super.dispatchEvent(event);
    }
  }
  const canvas = new Canvas();
  const camera = new THREE.OrthographicCamera(-500, 500, 500, -500, 1, 10000);
  camera.position.set(0, -1000, 1000);
  camera.up.set(0, 0, 1);
  const makeControls = () => {
    const controls = new OrbitControls(camera, canvas);
    controls.mouseButtons.LEFT = null;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
    return controls;
  };
  let controls = makeControls();
  const dispose = installOverlayNavigation(host, canvas);
  const log = [];
  const removePointer = installModelPointer(canvas, {
    getState: () => ({ mode }),
    beginBox: () => log.push('box'),
    orbit: (e) => log.push(['orbit', e.clientX, e.clientY, e.ctrlKey, e.metaKey, e.shiftKey]),
    point: () => log.push('point'),
    actions: {
      select: () => log.push('select'),
      'confirm-fastener-targets': () => log.push('confirm'),
      'finish-polysweep': () => log.push('confirm'),
      'finish-plate': () => log.push('confirm'),
    },
    move: () => {},
    leave: () => {},
  });
  const send = (target, type = 'pointerdown', extra = {}) => {
    const event = new Pointer(type, {
      pointerId: 7,
      pointerType: 'mouse',
      isPrimary: true,
      button: 1,
      buttons: 4,
      clientX: 300,
      clientY: 250,
      ...extra,
    });
    Object.defineProperty(event, 'target', { value: target, configurable: true });
    if (target === canvas) canvas.dispatchEvent(event);
    else captures.get(type)?.(event);
    return event;
  };
  return {
    canvas,
    camera,
    log,
    send,
    get captured() {
      return captured;
    },
    get controls() {
      return controls;
    },
    replace() {
      controls.dispose();
      controls = makeControls();
    },
    dispose() {
      dispose();
      removePointer();
      controls.dispose();
      assert.equal(captures.size, 0);
    },
  };
}

for (const kind of ['insertion-point', 'connection-marker'])
  test(`${kind}: pan and orbit use actual controls, preserve modifiers and release pointer without model action`, () => {
    const f = fixture(),
      target = { closest: (selector) => (selector.includes(kind) ? {} : null) };
    try {
      for (const extra of [
        {},
        { ctrlKey: true },
        { metaKey: true },
        { shiftKey: true },
        { button: 2, buttons: 2 },
        { button: 2, buttons: 2, ctrlKey: true },
      ]) {
        f.camera.position.set(0, -1000, 1000);
        f.controls.target.set(0, 0, 0);
        f.controls.update();
        const before = f.camera.position.clone(),
          direction = f.camera.quaternion.clone(),
          targetBefore = f.controls.target.clone();
        const down = f.send(target, 'pointerdown', extra);
        assert.ok(down.defaultPrevented);
        assert.equal(f.captured, 7, 'original pointer is captured by canvas controls');
        assert.deepEqual(f.log.at(-1), [
          'orbit',
          300,
          250,
          extra.ctrlKey,
          extra.metaKey,
          extra.shiftKey,
        ]);
        f.send(f.canvas, 'pointermove', { ...extra, clientX: 380, clientY: 290 });
        assert.ok(
          f.camera.position.distanceTo(before) > 1,
          `camera moves during drag ${JSON.stringify(extra)}`,
        );
        if (!extra.ctrlKey && !extra.metaKey && !extra.shiftKey) {
          assert.ok(f.camera.quaternion.angleTo(direction) < 1e-8, 'plain middle drag pans');
          assert.ok(f.controls.target.distanceTo(targetBefore) > 1);
        } else
          assert.ok(
            f.camera.quaternion.angleTo(direction) > 0.01,
            'modified navigation drag orbits',
          );
        f.send(f.canvas, 'pointerup', { ...extra, buttons: 0, clientX: 380, clientY: 290 });
        assert.equal(f.captured, null);
        assert.ok(
          f.log.every((entry) => Array.isArray(entry)),
          'no model selection, placement or box gesture',
        );
      }
      f.replace();
      const before = f.camera.position.clone();
      f.send(target);
      f.send(f.canvas, 'pointermove', { clientX: 420 });
      f.send(f.canvas, 'pointerup', { buttons: 0, clientX: 420 });
      assert.ok(
        f.camera.position.distanceTo(before) > 1,
        'replacement controls receive gestures too',
      );
    } finally {
      f.dispose();
    }
  });

test('overlay navigation leaves left clicks, grip drags, Alt selection, touch and unrelated UI with their owners', () => {
  const f = fixture();
  try {
    for (const [target, extra] of [
      [{ closest: () => ({}) }, { button: 0, buttons: 1 }],
      [{ closest: () => ({}) }, { button: 0, buttons: 1, altKey: true }],
      [{ closest: () => ({}) }, { pointerType: 'touch', button: 0, buttons: 1 }],
      [{ closest: () => null }, {}],
    ]) {
      const e = f.send(target, 'pointerdown', extra);
      assert.equal(e.defaultPrevented, false);
      assert.equal(f.captured, null);
      assert.equal(f.log.length, 0);
    }
  } finally {
    f.dispose();
  }
});

test('stationary right click preserves the vertex menu, while right drag does not open a menu', () => {
  const f = fixture(),
    menus = [];
  const target = {
    closest: () => target,
    matches: (s) => s === '.insertion-point',
    isConnected: true,
    dispatchEvent: (e) => menus.push(e),
  };
  try {
    f.send(target, 'pointerdown', { button: 2, buttons: 2 });
    f.send(f.canvas, 'pointerup', { button: 2, buttons: 0 });
    const menu = f.send(f.canvas, 'contextmenu', { button: 2, buttons: 0 });
    assert.equal(menu.defaultPrevented, true);
    assert.equal(menus.length, 1);
    assert.equal(menus[0].type, 'contextmenu');
    f.send(target, 'pointerdown', { button: 2, buttons: 2 });
    f.send(f.canvas, 'pointermove', { button: 2, buttons: 2, clientX: 380 });
    f.send(f.canvas, 'pointerup', { button: 2, buttons: 0, clientX: 380 });
    const dragMenu = f.send(f.canvas, 'contextmenu', { button: 2, buttons: 0, clientX: 380 });
    assert.equal(dragMenu.defaultPrevented, true);
    assert.equal(menus.length, 1, 'right drag must not trigger vertex menu');
    f.send(target, 'pointerdown', { button: 2, buttons: 2 });
    f.send(f.canvas, 'pointercancel', { button: 2, buttons: 0 });
    assert.equal(
      f.send(f.canvas, 'contextmenu', { button: 2, buttons: 0 }).defaultPrevented,
      true,
      'normal canvas menu still owned by controls',
    );
    assert.equal(menus.length, 1);
  } finally {
    f.dispose();
  }
});

for (const mode of ['fastenerTargets', 'polysweepCreate', 'plateCreate'])
  test(`${mode}: middle confirmation coexists with actual OrbitControls pan and orbit`, () => {
    const f = fixture(mode);
    try {
      f.send(f.canvas, 'pointerdown');
      f.send(f.canvas, 'pointerup', { buttons: 0 });
      assert.equal(f.log.filter((x) => x === 'confirm').length, 1);
      for (const extra of [{}, { ctrlKey: true }, { metaKey: true }]) {
        const before = f.camera.position.clone();
        f.send(f.canvas, 'pointerdown', extra);
        f.send(f.canvas, 'pointermove', { ...extra, clientX: 380, clientY: 290 });
        f.send(f.canvas, 'pointerup', { ...extra, buttons: 0, clientX: 380, clientY: 290 });
        assert.ok(f.camera.position.distanceTo(before) > 1);
        assert.equal(f.captured, null);
        assert.equal(f.log.filter((x) => x === 'confirm').length, 1);
      }
    } finally {
      f.dispose();
    }
  });
