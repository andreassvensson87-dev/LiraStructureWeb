import test from 'node:test';
import assert from 'node:assert/strict';
import {
  copySweepProperties,
  sweepDefaults,
  storeSweepDefaults,
  loadSweepDefaults,
  SWEEP_DEFAULTS_KEY,
} from '../src/model/sweep-properties.js';
import { profileSnapshot } from '../src/section-profile.js';
import { TIBNOR_PROFILES } from '../src/tibnor-catalog.js';
import { applyObjectBatch } from '../src/model/tools/transform-tool.js';
import { updateComponents } from '../src/components/fit.js';
import { beamSpliceDefaults } from '../src/components/beam-splice.js';
import { pointerCommand } from '../src/model/pointer-controller.js';
import { modelKeyboardCommand } from '../src/model/keyboard-command.js';
const source = {
  id: 'source',
  type: 'sweep',
  name: 'Balk A',
  prefix: 'B',
  number: 10,
  profile: 'rhs',
  width: 200,
  height: 300,
  thickness: 8,
  rotation: 45,
  start: [0, 0, 0],
  end: [2000, 0, 0],
  placement: { horizontalAlignment: 'left', verticalAlignment: 'top' },
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
  id: 'target',
  type: 'sweep',
  name: 'Balk B',
  prefix: 'B',
  number: 11,
  profile: 'rect',
  width: 100,
  height: 150,
  thickness: 12,
  rotation: 0,
  start: [200, 500, 600],
  end: [2200, 500, 600],
  profileUp: [0, 1, 0],
  placement: { horizontalAlignment: 'center', verticalAlignment: 'center' },
};
const catalog = {
  ...source,
  profile: 'custom',
  section: profileSnapshot(TIBNOR_PROFILES.find((p) => p.name === 'HEB 300')),
  width: 300,
  height: 300,
};
test('chosen property groups copy independently while target endpoints, numbering and reference orientation remain', () => {
  const before = structuredClone(target),
    copied = copySweepProperties(source, target, ['profile', 'material', 'placement']);
  assert.equal(copied.profile, 'rhs');
  assert.equal(copied.width, 200);
  assert.equal(copied.thickness, 8);
  assert.deepEqual(copied.material, source.material);
  assert.deepEqual(copied.placement, source.placement);
  for (const key of ['id', 'name', 'prefix', 'number', 'start', 'end', 'profileUp', 'rotation'])
    assert.deepEqual(copied[key], target[key]);
  assert.equal(copied.colorOverride, undefined);
  assert.deepEqual(target, before);
  copied.placement.horizontalAlignment = 'right';
  assert.equal(source.placement.horizontalAlignment, 'left');
  const name = copySweepProperties(source, target, ['name']);
  assert.equal(name.name, source.name);
  assert.equal(name.profile, target.profile);
});
test('profile snapshots travel with dimensions and are removed when copying a form profile', () => {
  const result = copySweepProperties(catalog, target, ['profile']);
  assert.deepEqual(result.section, structuredClone(catalog.section));
  assert.equal(result.width, 300);
  assert.notEqual(result.section, structuredClone(catalog.section));
  const form = copySweepProperties(source, result, ['profile']);
  assert.equal(form.section, undefined);
  assert.equal(form.profile, 'rhs');
  const round = copySweepProperties(
    { ...source, profile: 'chs', width: 100, height: 300 },
    target,
    ['profile'],
  );
  assert.equal(round.height, 100);
  assert.throws(
    () => copySweepProperties(source, { ...target, generatedBy: 'joint' }, ['profile']),
    /sweeps/,
  );
  assert.throws(() => copySweepProperties(source, target, ['start']), /Ogiltiga/);
});
test('automatic material and color can be copied explicitly without retaining target overrides', () => {
  const cleared = copySweepProperties(
    { ...source, material: null, colorOverride: null },
    { ...target, material: source.material, colorOverride: '#ff0000' },
    ['material', 'color'],
  );
  assert.equal(cleared.material, null);
  assert.equal(cleared.colorOverride, null);
  assert.equal(
    copySweepProperties(source, { ...target, colorOverride: '#ff0000' }, ['material'])
      .colorOverride,
    '#ff0000',
  );
});
test('last used properties persist across sessions without geometry, object name or model identities', () => {
  const map = new Map(),
    storage = { getItem: (k) => map.get(k), setItem: (k, v) => map.set(k, v) };
  const saved = storeSweepDefaults(storage, source),
    loaded = loadSweepDefaults(storage);
  assert.deepEqual(loaded, saved);
  for (const key of [
    'id',
    'type',
    'name',
    'prefix',
    'number',
    'start',
    'end',
    'profileUp',
    'generatedBy',
  ])
    assert.equal(loaded[key], undefined);
  assert.equal(loaded.rotation, 45);
  assert.deepEqual(loaded.material, source.material);
  storeSweepDefaults(storage, catalog);
  assert.deepEqual(loadSweepDefaults(storage).section, structuredClone(catalog.section));
  assert.throws(() => storeSweepDefaults(storage, { ...source, width: 0 }));
  assert.deepEqual(loadSweepDefaults(storage).section, structuredClone(catalog.section));
  map.set(SWEEP_DEFAULTS_KEY, 'broken');
  assert.equal(loadSweepDefaults(storage), null);
  map.set(
    SWEEP_DEFAULTS_KEY,
    JSON.stringify({ schema: 1, properties: { ...saved, profile: 'unknown' } }),
  );
  assert.equal(loadSweepDefaults(storage), null);
  map.set(
    SWEEP_DEFAULTS_KEY,
    JSON.stringify({ schema: 1, properties: { ...saved, material: { name: 'broken' } } }),
  );
  assert.equal(loadSweepDefaults(storage), null);
  assert.equal(
    loadSweepDefaults({
      getItem: () => {
        throw new Error('blocked');
      },
    }),
    null,
  );
  assert.deepEqual(
    storeSweepDefaults(
      {
        setItem: () => {
          throw new Error('blocked');
        },
      },
      source,
    ),
    sweepDefaults(source),
  );
});
test('copying to coupled beams regenerates the joint atomically and incompatible changes leave model untouched', () => {
  const a = {
      ...source,
      id: 'a',
      profile: 'i',
      width: 200,
      height: 300,
      thickness: 15,
      rotation: 0,
      placement: undefined,
      start: [-1000, 0, 0],
      end: [0, 0, 0],
    },
    b = { ...a, id: 'b', start: [0, 0, 0], end: [1000, 0, 0] };
  const spec = {
    id: 'bolt',
    revision: 1,
    name: 'M16×60',
    kind: 'bolt',
    diameter: 16,
    length: 60,
    head: { kind: 'hex', diameter: 24, height: 10 },
    nut: { acrossFlats: 24, thickness: 13 },
    washer: { innerDiameter: 18, outerDiameter: 30, thickness: 3 },
    thread: { length: 60, pitch: 2 },
  };
  const objects = updateComponents(
    [],
    [
      a,
      b,
      {
        id: 'joint',
        type: 'component',
        kind: 'beamSplice',
        ...beamSpliceDefaults,
        references: ['a', 'b'],
        boltSpec: spec,
      },
    ],
  );
  const batch = [a, b].map((s) => copySweepProperties({ ...a, width: 240 }, s, ['profile']));
  const changed = applyObjectBatch(objects, batch).objects;
  assert.equal(changed.find((s) => s.id === 'joint').plateWidth, 290);
  const saved = structuredClone(objects);
  assert.throws(
    () => applyObjectBatch(objects, [copySweepProperties(source, a, ['profile'])]),
    /H- eller I/,
  );
  assert.deepEqual(objects, saved);
});
test('property picking routes clicks and Enter to copying rather than drawing or geometry transforms', () => {
  assert.equal(
    pointerCommand({ mode: 'sweepProperties', drawing: false }),
    'sweep-property-target',
  );
  assert.equal(
    modelKeyboardCommand({ key: 'Enter' }, { mode: 'sweepProperties', editing: false }),
    'confirm-sweep-properties',
  );
  assert.equal(
    modelKeyboardCommand({ key: 'Escape' }, { mode: 'sweepProperties', editing: false }),
    'cancel',
  );
  assert.equal(
    modelKeyboardCommand(
      { key: 'Delete' },
      { mode: 'sweepProperties', editing: false, hasSelection: true },
    ),
    null,
  );
});
