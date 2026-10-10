import test from 'node:test';
import assert from 'node:assert/strict';
import { advancePlatePoint } from '../src/model/tools/plate-tool.js';
import { applyObjectBatch } from '../src/model/tools/transform-tool.js';
import { pointerCommand, installModelPointer } from '../src/model/pointer-controller.js';
import { createToolSession, resetToolInteraction } from '../src/model/tool-session.js';
test('plate point transition is atomic and duplicates do not mutate the draft', () => {
  const initial = { mode: 'plateCreate', polygon: [], planePoints: [], planeMode: 'XY' },
    a = advancePlatePoint(initial, [10, 20, 0]);
  assert.deepEqual(initial.polygon, []);
  assert.equal(a.kind, 'plane');
  const b = advancePlatePoint(a.operation, [1010, 20, 0]);
  assert.equal(b.operation.polygon.length, 2);
  assert.equal(a.operation.polygon.length, 1);
  assert.throws(() => advancePlatePoint(b.operation, [1010, 20, 0]));
  assert.equal(b.operation.polygon.length, 2);
  const c = advancePlatePoint(b.operation, [1010, 1020, 0]);
  assert.equal(advancePlatePoint(c.operation, [10, 20, 0], { exact: true }).kind, 'finish');
});
test('copy detaches nested geometry, assigns new identities and preserves sources', () => {
  const s = {
    id: 's',
    type: 'plate',
    prefix: 'P',
    number: 1,
    polygon: [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
  };
  const r = applyObjectBatch([s], [s], { copy: true, newId: () => 'copy' });
  assert.equal(r.objects.length, 2);
  assert.equal(r.objects[1].number, 2);
  r.objects[1].polygon[0][0] = 10;
  assert.equal(s.polygon[0][0], 0);
});

test('pointer routes typed length to plate and suppresses rotation clicks after axis selection', () => {
  assert.equal(
    pointerCommand({ mode: 'plateCreate', plateLength: true, hasLength: true }),
    'plate-length',
  );
  assert.equal(pointerCommand({ mode: 'rotate', picking: false }), null);
  assert.equal(pointerCommand({ drawing: true, hasStart: false }), 'start');
});
test('pointer cancellation and disposal prevent stale commits', () => {
  const surface = new EventTarget();
  let calls = 0;
  const dispose = installModelPointer(surface, {
    getState: () => ({ drawing: true }),
    beginBox() {},
    orbit() {},
    point: () => [0, 0, 0],
    actions: { start: () => calls++ },
    move() {},
    leave() {},
  });
  const event = (type) => {
    const e = new Event(type);
    Object.assign(e, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
    surface.dispatchEvent(e);
  };
  event('pointerdown');
  event('pointercancel');
  event('pointerup');
  assert.equal(calls, 0);
  event('pointerdown');
  event('pointerup');
  assert.equal(calls, 1);
  dispose();
  event('pointerdown');
  event('pointerup');
  assert.equal(calls, 1);
});
test('assembly main picks preserve secondaries even with Shift and do not request a placement point', () => {
  const surface = new EventTarget();
  let picked = 0;
  installModelPointer(surface, {
    getState: () => ({ mode: 'assemblyMain' }),
    beginBox() {
      assert.fail('main pick must not change secondary selection');
    },
    orbit() {},
    point() {
      assert.fail('main pick uses object hit');
    },
    actions: { 'assembly-main': () => picked++ },
    move() {},
    leave() {},
  });
  for (const type of ['pointerdown', 'pointerup']) {
    const event = new Event(type);
    Object.assign(event, { button: 0, pointerId: 1, clientX: 10, clientY: 10, shiftKey: true });
    surface.dispatchEvent(event);
  }
  assert.equal(picked, 1);
});
test('cancel clears transient operation but retains active workplane', () => {
  const s = createToolSession();
  s.operation = { mode: 'copy' };
  s.first = [1, 2, 3];
  s.temporaryPlane = { origin: [1, 2, 3] };
  s.typedPoint = [2, 3, 4];
  resetToolInteraction(s);
  assert.equal(s.operation, null);
  assert.equal(s.typedPoint, null);
  assert.deepEqual(s.temporaryPlane.origin, [1, 2, 3]);
});

test('fastener part picks receive pointer events without interpreting them as placement points', () => {
  const surface = new EventTarget();
  let picked = 0;
  const dispose = installModelPointer(surface, {
    getState: () => ({ mode: 'fastenerTargets', drawing: true }),
    beginBox() {},
    orbit() {},
    point() {
      assert.fail('target selection must use ray hits, not snapped placement points');
    },
    actions: {
      'fastener-target': (e) => {
        assert.equal(e.clientX, 10);
        picked++;
      },
    },
    move() {},
    leave() {},
  });
  for (const type of ['pointerdown', 'pointerup']) {
    const e = new Event(type);
    Object.assign(e, { button: 0, pointerId: 1, clientX: 10, clientY: 20 });
    surface.dispatchEvent(e);
  }
  assert.equal(picked, 1);
  dispose();
  assert.equal(pointerCommand({ mode: 'fastenerCreate', drawing: true, hasStart: false }), 'start');
  assert.equal(pointerCommand({ mode: 'fastenerCreate', drawing: true, hasStart: true }), 'finish');
});

test('neutral left press starts click-or-rectangle selection, while Ctrl-middle remains navigation', () => {
  const surface = new EventTarget(),
    boxes = [],
    orbits = [];
  let state = { drawing: false, mode: undefined, boxMode: false };
  const dispose = installModelPointer(surface, {
    getState: () => state,
    beginBox: (event) => boxes.push(event),
    orbit: (event) => orbits.push(event),
    point() {},
    actions: {
      select() {
        assert.fail('selection adapter owns click completion');
      },
    },
    move() {},
    leave() {},
  });
  const send = (button, extra = {}) => {
    const event = new Event('pointerdown');
    Object.assign(event, {
      button,
      pointerId: 1,
      clientX: 10,
      clientY: 20,
      pointerType: 'mouse',
      ...extra,
    });
    surface.dispatchEvent(event);
    return event;
  };
  send(0);
  assert.equal(boxes.length, 1);
  assert.equal(orbits.length, 0);
  send(0, { shiftKey: true });
  assert.equal(boxes.length, 2);
  assert.equal(boxes[1].shiftKey, true);
  send(1, { ctrlKey: true });
  assert.equal(orbits.length, 1);
  assert.equal(boxes.length, 2);
  state = { drawing: true };
  send(0);
  assert.equal(boxes.length, 2);
  assert.equal(orbits.length, 2);
  state = { drawing: false, mode: 'rotate', picking: true };
  send(0);
  assert.equal(boxes.length, 2);
  dispose();
});
