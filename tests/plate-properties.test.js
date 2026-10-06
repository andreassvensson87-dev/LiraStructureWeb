import test from 'node:test';
import assert from 'node:assert/strict';
import {
  copyPlateProperties,
  plateDefaults,
  storePlateDefaults,
  loadPlateDefaults,
  PLATE_DEFAULTS_KEY,
} from '../src/model/plate-properties.js';
import { validateObject } from '../src/model-object.js';
import { applyObjectBatch } from '../src/model/tools/transform-tool.js';
import { pointerCommand } from '../src/model/pointer-controller.js';
import { modelKeyboardCommand } from '../src/model/keyboard-command.js';
const source = {
  id: 'a',
  type: 'plate',
  name: 'Plåt A',
  prefix: 'PL',
  number: 1,
  frame: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0] },
  polygon: [
    [0, 0],
    [1000, 0],
    [1000, 600],
    [0, 600],
  ],
  thickness: 20,
  side: 'positive',
  contourOffset: 15,
  material: {
    id: 'steel',
    revision: 1,
    category: 'steel',
    name: 'S355',
    density: 7850,
    color: '#556677',
  },
  colorOverride: '#112233',
};
const target = {
  ...source,
  id: 'b',
  name: 'Plåt B',
  number: 2,
  frame: { origin: [2000, 1000, 500], u: [0, 1, 0], v: [0, 0, 1] },
  polygon: [
    [0, 0],
    [800, 0],
    [400, 500],
  ],
  thickness: 8,
  side: 'center',
  contourOffset: 0,
  material: null,
  colorOverride: null,
};
test('selected plate properties copy without touching contour, offset, world frame or identities', () => {
  const before = structuredClone(target),
    copied = copyPlateProperties(source, target, ['thickness', 'material', 'placement']);
  assert.equal(copied.thickness, 20);
  assert.equal(copied.side, 'positive');
  assert.deepEqual(copied.material, source.material);
  for (const key of [
    'id',
    'name',
    'prefix',
    'number',
    'frame',
    'polygon',
    'contourOffset',
    'colorOverride',
  ])
    assert.deepEqual(copied[key], target[key]);
  assert.deepEqual(target, before);
  assert.equal(validateObject(copied), '');
  copied.frame.origin[0] = 0;
  copied.material.name = 'Other';
  assert.equal(target.frame.origin[0], 2000);
  assert.equal(source.material.name, 'S355');
});
test('optional name and color copying are independent; automatic settings can clear target overrides', () => {
  const named = copyPlateProperties(source, target, ['name', 'color']);
  assert.equal(named.name, 'Plåt A');
  assert.equal(named.colorOverride, '#112233');
  assert.equal(named.thickness, 8);
  const cleared = copyPlateProperties(target, source, ['material', 'color']);
  assert.equal(cleared.material, null);
  assert.equal(cleared.colorOverride, null);
  assert.equal(cleared.thickness, 20);
  assert.throws(() => copyPlateProperties(source, target, ['polygon']), /Ogiltiga/);
  for (const type of ['polygoncut', 'linecut', 'sweep'])
    assert.throws(
      () => copyPlateProperties(source, { ...target, type }, ['thickness']),
      /fristående/,
    );
  assert.throws(
    () => copyPlateProperties(source, { ...target, generatedBy: 'joint' }, ['thickness']),
    /fristående/,
  );
  assert.throws(
    () => copyPlateProperties({ ...source, generatedBy: 'joint' }, target, ['thickness']),
    /fristående/,
  );
});
test('plate defaults persist separately and omit geometry, identities and name', () => {
  const map = new Map(),
    storage = { getItem: (k) => map.get(k), setItem: (k, v) => map.set(k, v) };
  const saved = storePlateDefaults(storage, source);
  assert.deepEqual(loadPlateDefaults(storage), saved);
  assert.equal(saved.thickness, 20);
  assert.equal(saved.contourOffset, 15);
  assert.equal(saved.side, 'positive');
  for (const key of ['id', 'type', 'frame', 'polygon', 'name', 'prefix', 'number', 'generatedBy'])
    assert.equal(saved[key], undefined);
  assert.deepEqual(saved.material, source.material);
  for (const change of [
    { thickness: 0 },
    { thickness: NaN },
    { side: 'bad' },
    { contourOffset: Infinity },
    { material: { name: 'bad' } },
    { colorOverride: 'red' },
  ])
    assert.throws(() => storePlateDefaults(storage, { ...source, ...change }));
  assert.deepEqual(loadPlateDefaults(storage), saved);
  map.set(PLATE_DEFAULTS_KEY, 'broken');
  assert.equal(loadPlateDefaults(storage), null);
  map.set(PLATE_DEFAULTS_KEY, JSON.stringify({ schema: 9, properties: saved }));
  assert.equal(loadPlateDefaults(storage), null);
  assert.equal(
    loadPlateDefaults({
      getItem: () => {
        throw new Error('blocked');
      },
    }),
    null,
  );
  assert.deepEqual(
    storePlateDefaults(
      {
        setItem: () => {
          throw new Error('blocked');
        },
      },
      source,
    ),
    plateDefaults(source),
  );
});
test('plate property batch preserves target contours in a single immutable model update', () => {
  const objects = [source, target],
    saved = structuredClone(objects);
  const next = applyObjectBatch(objects, [
    copyPlateProperties(source, target, ['thickness', 'placement']),
  ]).objects;
  assert.equal(next.find((o) => o.id === 'b').thickness, 20);
  assert.deepEqual(next.find((o) => o.id === 'b').polygon, target.polygon);
  assert.deepEqual(objects, saved);
});
test('plate picking and keyboard routing support Modify and cancellation', () => {
  assert.equal(
    pointerCommand({ mode: 'plateProperties', drawing: false }),
    'plate-property-target',
  );
  assert.equal(
    modelKeyboardCommand({ key: 'Enter' }, { mode: 'plateProperties', editing: false }),
    'confirm-plate-properties',
  );
  assert.equal(
    modelKeyboardCommand({ key: 'Escape' }, { mode: 'plateProperties', editing: false }),
    'cancel',
  );
  assert.equal(
    modelKeyboardCommand(
      { key: 'Delete' },
      { mode: 'plateProperties', editing: false, hasSelection: true },
    ),
    null,
  );
});
