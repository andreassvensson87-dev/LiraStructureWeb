import test from 'node:test';
import assert from 'node:assert/strict';
import { selectionGrips, moveGripPoints } from '../src/model/grips.js';
const a = { id: 'a', type: 'helperline', start: [0, 0, 0], end: [100, 0, 0] };
const b = { id: 'b', type: 'helperline', start: [100, 0, 0], end: [100, 100, 0] };
test('grips remain available for large selections; drawing exposes none', () => {
  const objects = Array.from({ length: 5 }, (_, i) => ({ ...a, id: String(i) }));
  assert.equal(selectionGrips(objects, new Set()).length, 0);
  assert.ok(selectionGrips(objects, new Set(['0', '1', '2', '3'])).length);
  assert.equal(selectionGrips(objects, new Set(objects.map((s) => s.id))).length, 2);
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

test('all point kinds receive the same displacement from an arbitrary move base, without collapsing endpoints', () => {
  const poly = {
    id: 'poly',
    type: 'polysweep',
    points: [
      [0, 0, 0],
      [100, 0, 0],
      [100, 100, 0],
    ],
    radii: [0, 20, 0],
  };
  const refs = [
    { id: 'a', kind: 'end' },
    { id: 'b', kind: 'end' },
    { id: 'poly', kind: 1 },
  ];
  const result = moveGripPoints([a, b, poly], refs, [1050, 2040, 0], [1000, 2000, 0]);
  assert.deepEqual(result[0].end, [150, 40, 0]);
  assert.deepEqual(result[1].end, [150, 140, 0]);
  assert.deepEqual(result[2].points, [
    [0, 0, 0],
    [150, 40, 0],
    [100, 100, 0],
  ]);
  assert.deepEqual(result[2].radii, poly.radii);
  assert.deepEqual(poly.points[1], [100, 0, 0]);
});

test('grip rectangle and additive/toggle selection deduplicate references and reject stale object points', async () => {
  const { selectGripRefs, validGripRefs, gripRefsInRect } = await import(
    '../src/model/grip-selection.js'
  );
  const first = { id: 'a', kind: 'end' },
    second = { id: 'b', kind: 'start' };
  const chosen = gripRefsInRect(
    [
      { x: 50, y: 30, grip: { refs: [first, second] } },
      { x: 200, y: 30, grip: { refs: [{ id: 'a', kind: 'start' }] } },
    ],
    { x: 100, y: 50 },
    { x: 0, y: 0 },
  );
  assert.deepEqual(chosen, [first, second]);
  const group = selectGripRefs([first], chosen, { additive: true });
  assert.deepEqual(group, chosen);
  assert.deepEqual(selectGripRefs(group, [first], { toggle: true }), [second]);
  assert.deepEqual(validGripRefs([a, b], [...group, first, { id: 'a', kind: 9 }], new Set(['a'])), [
    first,
  ]);
});

test('selecting every plate corner translates its frame out of plane; partial corners stay constrained', async () => {
  const { gripWorkPlane } = await import('../src/model/grips.js');
  const plate = {
    id: 'p',
    type: 'plate',
    frame: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0] },
    polygon: [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ],
    radii: [0, 10, 0, 0],
  };
  const refs = plate.polygon.map((_, kind) => ({ id: 'p', kind }));
  assert.equal(gripWorkPlane([plate], refs, [0, 0, 0]), null);
  const [moved] = moveGripPoints([plate], refs, [0, 0, 50], [0, 0, 0]);
  assert.deepEqual(moved.frame.origin, [0, 0, 50]);
  assert.deepEqual(moved.polygon, plate.polygon);
  assert.deepEqual(moved.radii, plate.radii);
  assert.ok(gripWorkPlane([plate], refs.slice(0, 2), [0, 0, 0]));
  assert.throws(() => moveGripPoints([plate], refs.slice(0, 2), [0, 0, 50], [0, 0, 0]), /plan/);
});
