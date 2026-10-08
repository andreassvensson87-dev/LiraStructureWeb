import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  INPUT_DEVICE_KEY,
  inputDevice,
  setInputDevice,
  inputWheelGesture,
} from '../src/input-device.js';
import { cameraPanOffset, installInputNavigation } from '../src/model/input-navigation.js';
const wheel = (extra = {}) => ({
  deltaX: 20,
  deltaY: 40,
  deltaMode: 0,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...extra,
});
test('input preference defaults to mouse and survives a separate module session', async () => {
  const previous = globalThis.localStorage,
    values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  try {
    setInputDevice('unknown');
    assert.equal(inputDevice(), 'mouse');
    setInputDevice('trackpad');
    assert.equal(values.get(INPUT_DEVICE_KEY), 'trackpad');
    const fresh = await import('../src/input-device.js?new-session');
    assert.equal(fresh.inputDevice(), 'trackpad');
  } finally {
    setInputDevice('mouse');
    globalThis.localStorage = previous;
  }
});
test('mouse wheel zooms; trackpad scroll pans and pinch zooms with normalized deltas', () => {
  assert.equal(inputWheelGesture(wheel(), 'mouse').action, 'zoom');
  assert.equal(inputWheelGesture(wheel(), 'trackpad').action, 'pan');
  assert.equal(inputWheelGesture(wheel({ ctrlKey: true }), 'trackpad').action, 'zoom');
  assert.deepEqual(
    inputWheelGesture(wheel({ deltaX: 0, deltaY: 2, deltaMode: 1, shiftKey: true }), 'trackpad'),
    { action: 'pan', x: 30, y: 0 },
  );
  assert.equal(inputWheelGesture(wheel({ deltaY: 1, deltaMode: 2 }), 'trackpad', 500).y, 500);
});
test('model panning follows camera orientation and zoom without changing object geometry', () => {
  const camera = new THREE.OrthographicCamera(-500, 500, 250, -250);
  camera.zoom = 2;
  const offset = cameraPanOffset(camera, 100, 100, 1000, 500);
  assert.deepEqual(offset.toArray(), [50, -50, 0]);
  camera.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  assert.ok(
    cameraPanOffset(camera, 100, 0, 1000, 500).distanceTo(new THREE.Vector3(0, 50, 0)) < 1e-8,
  );
});
test('trackpad interception pans current controls, leaves zoom to OrbitControls and respects disabled controls', () => {
  let listener;
  const host = {
    clientWidth: 1000,
    clientHeight: 500,
    addEventListener: (_type, fn) => {
      listener = fn;
    },
    removeEventListener: () => {
      listener = null;
    },
  };
  const camera = new THREE.OrthographicCamera(-500, 500, 250, -250);
  let controls = { enabled: true, enablePan: true, target: new THREE.Vector3(), update() {} };
  const dispose = installInputNavigation(host, camera, () => controls);
  setInputDevice('trackpad');
  const event = wheel({
    preventDefault() {
      this.prevented = true;
    },
    stopImmediatePropagation() {
      this.stopped = true;
    },
  });
  listener(event);
  assert.ok(event.stopped);
  assert.deepEqual(controls.target.toArray(), [20, -40, 0]);
  assert.equal(camera.zoom, 1);
  controls = { enabled: false, enablePan: true, target: new THREE.Vector3(), update() {} };
  listener(wheel({ ...event }));
  assert.deepEqual(controls.target.toArray(), [0, 0, 0]);
  const pinch = wheel({
    ctrlKey: true,
    preventDefault() {
      throw Error('Must remain available for OrbitControls');
    },
  });
  listener(pinch);
  dispose();
  assert.equal(listener, null);
  setInputDevice('mouse');
});

test('zoom speed persists, bounds invalid values, and scales zoom without changing pan', async () => {
  const { ZOOM_SPEED_KEY, normalizeZoomSpeed, zoomSpeed, setZoomSpeed } = await import(
    '../src/input-device.js'
  );
  const previous = globalThis.localStorage,
    values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  try {
    for (const invalid of [null, '', NaN, Infinity, 0, 0.1, 5, 'bad'])
      assert.equal(normalizeZoomSpeed(invalid), 1);
    setZoomSpeed(0.25);
    assert.equal(inputWheelGesture(wheel(), 'mouse').y, 10);
    setZoomSpeed(4);
    assert.equal(zoomSpeed(), 4);
    assert.equal(values.get(ZOOM_SPEED_KEY), '4');
    assert.equal(inputWheelGesture(wheel(), 'mouse').y, 160);
    assert.deepEqual(inputWheelGesture(wheel(), 'trackpad'), { action: 'pan', x: 20, y: 40 });
    assert.equal(inputWheelGesture(wheel({ ctrlKey: true }), 'trackpad').y, 160);
    const fresh = await import('../src/input-device.js?zoom-session');
    assert.equal(fresh.zoomSpeed(), 4);
  } finally {
    setZoomSpeed(1);
    globalThis.localStorage = previous;
  }
});
test('model wheel uses current zoom speed and reapplies it to replaced OrbitControls', async () => {
  const { setZoomSpeed } = await import('../src/input-device.js');
  let listener;
  const host = {
    clientHeight: 500,
    addEventListener: (_type, fn) => {
      listener = fn;
    },
    removeEventListener() {},
  };
  let controls = {};
  const dispose = installInputNavigation(host, new THREE.OrthographicCamera(), () => controls);
  try {
    setZoomSpeed(0.5);
    listener(wheel());
    assert.equal(controls.zoomSpeed, 0.5);
    controls = {};
    setZoomSpeed(2);
    listener(wheel({ ctrlKey: true }));
    assert.equal(controls.zoomSpeed, 2);
  } finally {
    dispose();
    setZoomSpeed(1);
  }
});

test('inverted zoom persists and reverses wheel zoom without changing pan or pinch', async () => {
  const { ZOOM_INVERTED_KEY, zoomInverted, setZoomInverted } = await import(
    '../src/input-device.js'
  );
  const previous = globalThis.localStorage,
    values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  let listener;
  const host = {
    clientHeight: 500,
    addEventListener: (_type, fn) => {
      listener = fn;
    },
    removeEventListener() {},
  };
  const controls = {};
  const dispose = installInputNavigation(host, new THREE.OrthographicCamera(), () => controls);
  try {
    const freshDefault = await import('../src/input-device.js?inverted-default');
    assert.equal(freshDefault.zoomInverted(), false);
    setZoomInverted(true);
    assert.equal(zoomInverted(), true);
    assert.equal(values.get(ZOOM_INVERTED_KEY), 'true');
    const fresh = await import('../src/input-device.js?inverted-session');
    assert.equal(fresh.zoomInverted(), true);
    assert.equal(inputWheelGesture(wheel(), 'mouse').y, -40);
    assert.equal(inputWheelGesture(wheel({ deltaY: -40 }), 'mouse').y, 40);
    assert.deepEqual(inputWheelGesture(wheel(), 'trackpad'), { action: 'pan', x: 20, y: 40 });
    assert.equal(inputWheelGesture(wheel({ ctrlKey: true }), 'trackpad').y, 40);
    assert.equal(inputWheelGesture(wheel({ metaKey: true }), 'trackpad').y, 40);
    listener(wheel());
    assert.equal(controls.zoomSpeed, 1);
    listener(wheel({ ctrlKey: true }));
    assert.equal(controls.zoomSpeed, 1);
    setZoomInverted(false);
    assert.equal(inputWheelGesture(wheel(), 'mouse').y, 40);
    listener(wheel());
    assert.equal(controls.zoomSpeed, 1);
  } finally {
    dispose();
    setZoomInverted(false);
    globalThis.localStorage = previous;
  }
});
