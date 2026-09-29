import test from 'node:test';
import assert from 'node:assert/strict';
import { selectionGrips, moveGripPoints } from '../src/model/grips.js';
const a = { id: 'a', type: 'helperline', start: [0, 0, 0], end: [100, 0, 0] };
const b = { id: 'b', type: 'helperline', start: [100, 0, 0], end: [100, 100, 0] };
test('only 1–4 selected objects expose grips; drawing exposes none', () => {
  const objects = Array.from({ length: 5 }, (_, i) => ({ ...a, id: String(i) }));
  assert.equal(selectionGrips(objects, new Set()).length, 0);
  assert.ok(selectionGrips(objects, new Set(['0', '1', '2', '3'])).length);
  assert.equal(selectionGrips(objects, new Set(objects.map((s) => s.id))).length, 0);
  assert.equal(selectionGrips(objects, new Set(['0']), true).length, 0);
});
test('coincident selected endpoints share a grip without including unselected objects', () => {
  const grips = selectionGrips([a, b, { ...a, id: 'unselected' }], new Set(['a', 'b']));
  assert.equal(grips.length, 3);
  const joint = grips.find((g) => g.refs.length === 2);
  assert.deepEqual(joint.refs, [
    { id: 'a', kind: 'end' },
    { id: 'b', kind: 'start' },
  ]);
  const result = moveGripPoints([a, b], joint.refs, [150, 20, 0]);
  assert.deepEqual(result[0].end, result[1].start);
  assert.deepEqual(result[0].start, a.start);
  assert.deepEqual(result[1].end, b.end);
  assert.deepEqual(a.end, [100, 0, 0]);
});
test('screen overlap at different depths does not merge grips', () => {
  const grips = selectionGrips([a, { ...b, start: [100, 0, 50] }], new Set(['a', 'b']));
  assert.equal(grips.length, 4);
});
test('plate corners stay in their plane during group editing', () => {
  const p = {
    id: 'p',
    type: 'plate',
    frame: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0] },
    polygon: [
      [0, 0],
      [100, 0],
      [0, 100],
    ],
  };
  assert.deepEqual(
    moveGripPoints([p], [{ id: 'p', kind: 0 }], [10, 20, 0])[0].polygon[0],
    [10, 20],
  );
  assert.throws(() => moveGripPoints([p], [{ id: 'p', kind: 0 }], [10, 20, 50]), /plan/);
});
