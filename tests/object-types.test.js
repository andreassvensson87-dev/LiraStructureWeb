import test from 'node:test';
import assert from 'node:assert/strict';
import { createObjectRegistry } from '../src/model/object-types/registry.js';
import { objectType, objectTypes } from '../src/model/object-types/index.js';
import { sweepType } from '../src/model/object-types/sweep-type.js';
import {
  validateObject,
  objectAnchors,
  objectGeometry,
  objectSegments,
} from '../src/model-object.js';
import { transformObject } from '../src/transform.js';
import { rotateObject } from '../src/rotation.js';
import { planeFrame } from '../src/plate.js';
import { partKey } from '../src/part-marks.js';

const sweep = {
  id: 'beam',
  profile: 'rect',
  width: 200,
  height: 300,
  thickness: 12,
  rotation: 0,
  start: [0, 0, 0],
  end: [3000, 0, 0],
};
const plate = {
  id: 'plate',
  type: 'plate',
  frame: planeFrame('XY', [[0, 0, 0]]),
  polygon: [
    [0, 0],
    [1000, 0],
    [1000, 1000],
    [0, 1000],
  ],
  thickness: 100,
  side: 'center',
};
const polygoncut = { ...plate, id: 'cut', type: 'polygoncut', targets: ['beam'] };
const linecut = {
  ...polygoncut,
  id: 'line',
  type: 'linecut',
  polygon: [
    [0, 0],
    [1000, 0],
  ],
  side: 'positive',
};

for (const object of [sweep, plate, polygoncut, linecut]) {
  test(`${object.type ?? 'legacy sweep'} implements geometry, snap and immutable transformation contract`, () => {
    const before = structuredClone(object);
    assert.equal(validateObject(object), '');
    const geometry = objectGeometry(object);
    assert.ok(geometry.attributes.position.count > 0);
    geometry.dispose();
    assert.ok(objectSegments(object).length > 0);
    const moved = transformObject(object, 'copy', [0, 0, 0], [10, 20, 30]);
    assert.deepEqual(
      objectAnchors(moved),
      objectAnchors(object).map((p) => p.map((v, i) => v + [10, 20, 30][i])),
    );
    const turned = rotateObject(object, [0, 0, 0], 'Z', 90);
    const expected = objectAnchors(object).map(([x, y, z]) => [-y, x, z]);
    objectAnchors(turned).forEach((p, i) =>
      p.forEach((v, j) => assert.ok(Math.abs(v - expected[i][j]) < 1e-6)),
    );
    if (!objectType(object).cut) assert.equal(partKey(moved, []), partKey(object, []));
    assert.deepEqual(object, before);
  });
}

test('legacy and explicit sweeps share one definition', () => {
  assert.equal(objectType(sweep), objectType({ ...sweep, type: 'sweep' }));
  assert.deepEqual(
    objectTypes.list().map((t) => t.id),
    ['sweep', 'plate', 'polygoncut', 'linecut', 'helperline', 'helperpoint', 'fastener'],
  );
});

test('unknown objects cannot silently acquire sweep behavior', () => {
  const unknown = { ...sweep, type: 'future-object' };
  assert.match(validateObject(unknown), /Okänd objekttyp/);
  assert.throws(() => objectGeometry(unknown), /Okänd objekttyp/);
  assert.throws(() => transformObject(unknown, 'move', [0, 0, 0], [1, 2, 3]), /Okänd objekttyp/);
  assert.throws(() => objectType(null), /Okänd objekttyp/);
});

test('registry rejects duplicate or incomplete definitions at startup', () => {
  assert.throws(() => createObjectRegistry([sweepType, sweepType]), /duplicerad/);
  assert.throws(() => createObjectRegistry([{ ...sweepType, anchors: null }]), /anchors/);
  assert.throws(() => createObjectRegistry([{ ...sweepType, partFrame: null }]), /ritnings/);
  assert.throws(() => createObjectRegistry([{ ...sweepType, cut: true }]), /cutGeometry/);
});

test('a new definition can be registered without altering built-in types', () => {
  const definition = { ...sweepType, id: 'custom-beam', label: 'Custom beam', prefix: 'CB' };
  const registry = createObjectRegistry([definition]);
  definition.label = 'changed';
  assert.equal(registry.get({ type: 'custom-beam' }).label, 'Custom beam');
  assert.equal(registry.find(sweep), undefined);
  assert.equal(objectTypes.find({ type: 'custom-beam' }), undefined);
  assert.ok(Object.isFrozen(registry.get({ type: 'custom-beam' })));
});

test('point edit and transformation modes cannot corrupt a different object shape', () => {
  assert.throws(() => transformObject(plate, 'start', [0, 0, 0], [1, 2, 3]), /punktredigering/);
  assert.throws(() => transformObject(sweep, 'unknown', [0, 0, 0], [1, 2, 3]), /transformation/);
  assert.deepEqual(transformObject(sweep, 'start', [0, 0, 0], [1, 2, 3]).end, sweep.end);
});
