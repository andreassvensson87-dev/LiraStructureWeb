import test from 'node:test';
import assert from 'node:assert/strict';
import { SelectionScope } from '../src/inspector/selection-scope.js';
import { applyObjectBatch } from '../src/model/tools/transform-tool.js';
const sweep = (id) => ({
  id,
  name: id,
  type: 'sweep',
  profile: 'rect',
  width: 100,
  height: 200,
  thickness: 0,
  rotation: 0,
  start: [0, 0, 0],
  end: [1000, 0, 0],
});
const plate = {
  id: 'p',
  name: 'Plate',
  type: 'plate',
  polygon: [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ],
  frame: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0] },
  thickness: 10,
  side: 'center',
};
test('selection scope keeps mixed selection and scopes old and new sweeps by real type', () => {
  const objects = [sweep('a'), { ...sweep('b'), type: undefined }, plate];
  const before = structuredClone(objects);
  const scope = new SelectionScope();
  scope.sync(objects);
  assert.equal(scope.choose('sweep', objects).length, 2);
  assert.deepEqual(scope.groups(objects), [
    { id: 'sweep', label: 'Sweep', count: 2 },
    { id: 'plate', label: 'Plate', count: 1 },
  ]);
  assert.deepEqual(
    scope.sync(objects.map((o) => ({ ...o }))).map((o) => o.id),
    ['a', 'b'],
  );
  assert.deepEqual(objects, before);
  assert.deepEqual(scope.choose('plate', objects), [plate]);
  assert.deepEqual(scope.choose('', objects), objects);
});
test('scope resets for a new selection and rejects types absent from it', () => {
  const scope = new SelectionScope(),
    objects = [sweep('a'), plate];
  scope.sync(objects);
  scope.choose('sweep', objects);
  assert.deepEqual(scope.sync([plate]), [plate]);
  assert.equal(scope.type, '');
  assert.throws(() => scope.choose('sweep', [plate]), /markeringen/);
});
test('committing a scoped geometry and material batch leaves plates and unselected sweeps intact', () => {
  const objects = [sweep('a'), sweep('b'), plate, sweep('outside')];
  const before = structuredClone(objects);
  const scope = new SelectionScope();
  scope.sync(objects.slice(0, 3));
  const selected = scope.choose('sweep', objects.slice(0, 3));
  const batch = selected.map((s) => ({
    ...s,
    width: 150,
    material: {
      id: 's355',
      name: 'S355',
      revision: 1,
      category: 'steel',
      density: 7850,
      color: '#667788',
    },
  }));
  const result = applyObjectBatch(objects, batch).objects;
  assert.equal(result[0].width, 150);
  assert.equal(result[1].material.name, 'S355');
  assert.deepEqual(
    result.find((o) => o.id === 'p'),
    before[2],
  );
  assert.deepEqual(
    result.find((o) => o.id === 'outside'),
    before[3],
  );
  assert.deepEqual(objects, before);
});
