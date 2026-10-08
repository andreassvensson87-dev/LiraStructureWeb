import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { setZoomInverted } from '../src/input-device.js';
import { installViewportWheel } from '../src/viewport-wheel.js';
function setup() {
  let listener, options;
  const forwarded = [];
  const host = {
    addEventListener(type, fn, opts) {
      assert.equal(type, 'wheel');
      listener = fn;
      options = opts;
    },
    removeEventListener() {},
  };
  const canvas = {
    ownerDocument: {
      defaultView: {
        WheelEvent: class {
          constructor(type, init) {
            this.type = type;
            for (const [key, value] of Object.entries(init))
              if (!['bubbles', 'cancelable'].includes(key)) this[key] = value;
          }
        },
      },
    },
    dispatchEvent(event) {
      forwarded.push(event);
    },
  };
  installViewportWheel(host, canvas);
  return {
    canvas,
    forwarded,
    options,
    send(target) {
      const event = {
        target,
        clientX: 120,
        clientY: 240,
        deltaX: 0,
        deltaY: -60,
        deltaZ: 0,
        deltaMode: 0,
        ctrlKey: true,
        preventDefault() {
          this.prevented = true;
        },
        stopPropagation() {
          this.stopped = true;
        },
      };
      listener(event);
      return event;
    },
  };
}
test('pinch over a newly selected handle zooms canvas at the same cursor, not browser', () => {
  const s = setup(),
    event = s.send({ tagName: 'BUTTON' });
  assert.deepEqual(s.options, { capture: true, passive: false });
  assert.ok(event.prevented);
  assert.ok(event.stopped);
  assert.equal(s.forwarded.length, 1);
  const wheel = s.forwarded[0];
  assert.equal(wheel.ctrlKey, true);
  assert.equal(wheel.deltaY, -60);
  assert.equal(wheel.clientX, 120);
  assert.equal(wheel.clientY, 240);
});
test('canvas wheel cancels browser default without duplicating model zoom', () => {
  const s = setup(),
    event = s.send(s.canvas);
  assert.ok(event.prevented);
  assert.equal(event.stopped, undefined);
  assert.equal(s.forwarded.length, 0);
});

test('inversion changes actual OrbitControls zoom on canvas and overlay exactly once', () => {
  let capture;
  const host = {
    addEventListener(_type, listener) {
      capture = listener;
    },
    removeEventListener() {},
  };
  const root = new EventTarget();
  class Wheel extends Event {
    constructor(type, init) {
      super(type, { cancelable: true });
      for (const [key, value] of Object.entries(init))
        if (!['bubbles', 'cancelable'].includes(key)) this[key] = value;
    }
  }
  class Canvas extends EventTarget {
    style = {};
    ownerDocument = { defaultView: { WheelEvent: Wheel } };
    getRootNode() {
      return root;
    }
    dispatchEvent(event) {
      Object.defineProperty(event, 'target', { value: this, configurable: true });
      capture(event);
      if (!event.cancelBubble) return super.dispatchEvent(event);
      return false;
    }
  }
  const canvas = new Canvas();
  const camera = new THREE.OrthographicCamera(-500, 500, 500, -500);
  camera.position.set(0, 0, 1000);
  const controls = new OrbitControls(camera, canvas);
  installViewportWheel(host, canvas);
  const send = (target, deltaY, ctrlKey = false) => {
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    const event = new Wheel('wheel', {
      deltaX: 0,
      deltaY,
      deltaZ: 0,
      deltaMode: 0,
      clientX: 120,
      clientY: 240,
      ctrlKey,
      metaKey: false,
    });
    Object.defineProperty(event, 'target', { value: target, configurable: true });
    if (target === canvas) canvas.dispatchEvent(event);
    else capture(event);
    return camera.zoom;
  };
  try {
    setZoomInverted(false);
    const normal = send(canvas, 60);
    assert.ok(normal < 1);
    setZoomInverted(true);
    const inverted = send(canvas, 60);
    assert.ok(inverted > 1);
    assert.ok(Math.abs(inverted * normal - 1) < 1e-10);
    assert.equal(send({ tagName: 'BUTTON' }, 60), inverted);
    assert.ok(send(canvas, -60) < 1);
    assert.ok(send(canvas, 60, true) < 1);
    setZoomInverted(false);
    assert.equal(send(canvas, 60), normal);
  } finally {
    setZoomInverted(false);
    controls.dispose();
  }
});
