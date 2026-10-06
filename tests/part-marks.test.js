import test from 'node:test';
import assert from 'node:assert/strict';
import { numberParts, partStatus, partKey } from '../src/part-marks.js';
import { drawingStamp } from '../src/drawing-manager.js';
import { resolveFit } from '../src/components/fit.js';
const beam = {
  id: 'a',
  profile: 'rect',
  width: 200,
  height: 300,
  thickness: 12,
  rotation: 0,
  start: [0, 0, 0],
  end: [3000, 0, 0],
};
test('equal parts share mark despite location and unique identity', () => {
  const b = {
      ...beam,
      id: 'b',
      prefix: 'Q',
      number: 44,
      start: [100, 400, 500],
      end: [3100, 400, 500],
    },
    state = numberParts([beam, b]);
  assert.equal(state.assignments.a.mark, state.assignments.b.mark);
  assert.equal(partKey({ ...beam, rotation: 90 }, []), partKey(beam, []));
});
test('material or geometry change flags mark and numbering never reuses old marks', () => {
  const state = numberParts([beam]),
    changed = { ...beam, width: 250 };
  assert.equal(partStatus(changed, [changed], state).valid, false);
  const next = numberParts([changed], state);
  assert.equal(next.assignments.a.mark, 'B-002');
  assert.equal(numberParts([beam], next).assignments.a.mark, 'B-001');
  assert.notEqual(
    partKey(beam, []),
    partKey({ ...beam, material: { id: 'steel', revision: 1, name: 'S', density: 7850 } }, []),
  );
});
test('machining is included and translated cut stays equivalent', () => {
  const c = {
    id: 'c',
    type: 'polygoncut',
    targets: ['a'],
    frame: { origin: [500, 0, 0], u: [1, 0, 0], v: [0, 1, 0] },
    polygon: [
      [0, 0],
      [100, 0],
      [100, 100],
    ],
    thickness: 1000,
    side: 'center',
  };
  assert.notEqual(partKey(beam, [c]), partKey(beam, []));
  const moved = { ...beam, start: [100, 0, 0], end: [3100, 0, 0] },
    cut = { ...c, frame: { ...c.frame, origin: [600, 0, 0] } };
  assert.equal(partKey(beam, [c]), partKey(moved, [cut]));
});
test('single part record invalidates when source changes or disappears', () => {
  const parts = numberParts([beam]),
    record = { type: 'SP', sourceId: 'a', partKey: parts.assignments.a.key };
  assert.ok(drawingStamp(record, { objects: [beam], parts }));
  assert.equal(drawingStamp(record, { objects: [], parts }), null);
  assert.equal(drawingStamp(record, { objects: [{ ...beam, width: 210 }], parts }), null);
});
test('Fit numbering uses only the machining planes for each connected part', () => {
  const a = { ...beam, type: 'sweep' };
  const b = { ...a, id: 'b', start: [3000, 2000, 0], end: [3000, 0, 0] };
  const definition = {
    id: 'fit',
    type: 'component',
    kind: 'fit',
    references: ['a', 'b'],
    mode: 'miter',
    gap: 0,
    endA: 'end',
    endB: 'end',
  };
  const fit = resolveFit(definition, [a, b]);
  const model = [a, b, fit];
  const saved = structuredClone(model);
  const numbered = numberParts(model);
  assert.equal(Object.keys(numbered.assignments).length, 2);
  for (const part of [a, b]) {
    const ownCut = fit.cuts.find((c) => c.targets.includes(part.id));
    assert.equal(partKey(part, model), partKey(part, [ownCut]));
    assert.notEqual(partKey(part, model), partKey(part, []));
    assert.equal(partStatus(part, model, numbered).valid, true);
  }
  const changed = resolveFit({ ...definition, gap: 10 }, [a, b]);
  assert.equal(partStatus(a, [a, b, changed], numbered).valid, false);
  assert.equal(partStatus(b, [a, b, changed], numbered).valid, false);
  const abut = resolveFit({ ...definition, mode: 'abut' }, [a, b]);
  assert.equal(partKey(a, [a, b, abut]), partKey(a, []));
  assert.notEqual(partKey(b, [a, b, abut]), partKey(b, []));
  assert.doesNotThrow(() => numberParts([a, b, abut], numbered));
  assert.deepEqual(model, saved);
});
