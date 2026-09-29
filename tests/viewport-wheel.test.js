import test from 'node:test';
import assert from 'node:assert/strict';
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
            Object.assign(this, init);
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
