import test from 'node:test';
import assert from 'node:assert/strict';
import { advancePlatePoint } from '../src/model/tools/plate-tool.js';
import { applyObjectBatch, transformCandidates } from '../src/model/tools/transform-tool.js';
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
test('move candidates preserve source and use relative displacement', () => {
  const s = { id: 's', start: [1, 2, 3], end: [4, 5, 6] },
    r = transformCandidates({ mode: 'move', sources: [s] }, [0, 0, 0], [10, 20, 30]);
  assert.deepEqual(r[0].start, [11, 22, 33]);
  assert.deepEqual(s.start, [1, 2, 3]);
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
