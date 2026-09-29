import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDrawingPan } from '../src/drawing-pan.js';
function setup(blocked = () => false) {
  const handlers = {},
    classes = new Set();
  let captured = null;
  const workspace = {
    scrollLeft: 300,
    scrollTop: 200,
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) },
    addEventListener: (type, handler) => (handlers[type] = handler),
    setPointerCapture: (id) => (captured = id),
    hasPointerCapture: (id) => captured === id,
    releasePointerCapture: () => (captured = null),
  };
  const pan = installDrawingPan(workspace, { blocked });
  const fire = (type, values = {}) => {
    const event = {
      button: 2,
      pointerId: 1,
      clientX: 100,
      clientY: 100,
      preventDefault() {
        this.prevented = true;
      },
      stopImmediatePropagation() {
        this.stopped = true;
      },
      ...values,
    };
    handlers[type](event);
    return event;
  };
  return { workspace, pan, fire, classes };
}
test('secondary click-drag pans workspace and consumes events before annotation tools', () => {
  const { workspace, pan, fire, classes } = setup();
  assert.equal(fire('pointerdown').stopped, true);
  assert.equal(pan.active, true);
  fire('pointermove', { clientX: 150, clientY: 80 });
  assert.equal(workspace.scrollLeft, 250);
  assert.equal(workspace.scrollTop, 220);
  assert.equal(fire('pointerup').stopped, true);
  assert.equal(pan.active, false);
  assert.equal(classes.size, 0);
});
test('left clicks and active object drags are preserved; cancellation releases pan', () => {
  const { pan, fire } = setup();
  assert.equal(fire('pointerdown', { button: 0 }).stopped, undefined);
  assert.equal(pan.active, false);
  fire('pointerdown', { button: 1 });
  pan.cancel();
  assert.equal(pan.active, false);
  const blocked = setup(() => true);
  assert.equal(blocked.fire('pointerdown').stopped, undefined);
  assert.equal(blocked.pan.active, false);
});

test('annotation context menu keeps secondary click while middle drag can still pan', () => {
  const { pan, fire } = setup();
  const target = {
    closest: (selector) => (selector.split(',').includes('[data-annotation]') ? {} : null),
  };
  assert.equal(fire('pointerdown', { target }).stopped, undefined);
  assert.equal(pan.active, false);
  assert.equal(fire('pointerdown', { target, button: 1 }).stopped, true);
  assert.equal(pan.active, true);
});
