import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultFasteners, withDefaultFasteners } from '../src/fasteners/default-catalog.js';
import {
  latestFasteners,
  validateFastenerSpec,
  defaultHoleForSpec,
} from '../src/fasteners/library.js';
import { withFastenerLength, fastenerFitWarnings } from '../src/fasteners/manual-length.js';
import { assemblyDefaults } from '../src/fasteners/assembly.js';
import { automaticPlacement } from '../src/fasteners/placement.js';
import { validateFastener } from '../src/fasteners/object-type.js';
import { geometryForModel } from '../src/model-object.js';
import { parseProjectFile, serializeProject } from '../src/project/project-file.js';
import { createProject } from '../src/project/project-state.js';

const plate = {
  id: 'plate',
  type: 'plate',
  frame: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0] },
  polygon: [
    [-100, -100],
    [100, -100],
    [100, 100],
    [-100, 100],
  ],
  thickness: 20,
  side: 'positive',
};

test('built-ins cover metric families with ISO accessory geometry, detached from user versions', () => {
  const records = defaultFasteners();
  for (const standard of ['ISO 4014', 'ISO 4017', 'DIN 976-1']) {
    const family = records.filter((s) => s.standard === standard);
    assert.deepEqual(
      family.map((s) => s.diameter),
      [8, 10, 12, 16, 20, 24, 30, 36],
    );
    for (const spec of family) {
      validateFastenerSpec(spec);
      assert.equal(spec.grade, '8.8');
      assert.ok(spec.washer.innerDiameter > spec.diameter);
      assert.ok(spec.washer.innerDiameter < spec.nut.acrossFlats);
    }
  }
  const m10 = records.find((s) => s.standard === 'ISO 4017' && s.diameter === 10);
  assert.equal(m10.head.diameter, 16, 'ISO width, not DIN 933 width 17');
  assert.deepEqual(m10.nut, { acrossFlats: 16, thickness: 8.4 });
  assert.deepEqual(m10.washer, { innerDiameter: 10.5, outerDiameter: 20, thickness: 2 });
  const edited = { ...m10, revision: 2, name: 'Min skruv', coating: 'Egen yta' };
  const own = { ...m10, id: 'own', name: 'Egen' };
  const installed = withDefaultFasteners([edited, own]);
  assert.equal(installed.length, records.length + 1);
  assert.deepEqual(
    installed.find((s) => s.id === m10.id),
    edited,
  );
  assert.deepEqual(withDefaultFasteners(installed), installed);
  installed[0].nut.thickness = 99;
  assert.equal(defaultFasteners().find((s) => s.id === m10.id).nut.thickness, 8.4);
  assert.equal(
    latestFasteners(withDefaultFasteners([m10, edited])).find((s) => s.id === m10.id).revision,
    2,
  );
  assert.throws(() => validateFastenerSpec({ ...m10, standard: 'DIN 976-1' }), /gängstång/);
  assert.throws(
    () => validateFastenerSpec({ ...records.find((s) => s.kind === 'rod'), standard: 'ISO 4017' }),
    /sexkant/,
  );
});

test('all built-ins place, render and round-trip with manual length and available hardware', () => {
  const records = defaultFasteners();
  const before = structuredClone(records);
  const placed = records.map((product, i) => {
    const spec = withFastenerLength(product, product.kind === 'rod' ? 203.5 : 123.5);
    const nut = !!spec.nut,
      washer = !!spec.washer;
    const result = automaticPlacement(
      {
        id: `s${i}`,
        type: 'fastener',
        spec,
        placementMode: 'range',
        lengthMode: 'manual',
        drillDepth: 100,
        assembly: {
          ...assemblyDefaults(spec),
          nearWasher: washer,
          farWasher: washer && nut,
          extraNut: nut,
        },
        ...(spec.kind === 'rod' ? { startAllowance: 50 } : {}),
        holes: [defaultHoleForSpec(spec, plate.id)],
      },
      [0, 0, -100],
      [0, 0, -99],
      [plate],
    );
    assert.equal(validateFastener(result), '');
    assert.equal(result.spec.length, spec.length);
    if (nut)
      assert.equal(
        result.accessories.filter((a) => a.kind === 'nut').length,
        spec.kind === 'rod' ? 3 : 2,
      );
    const g = geometryForModel(result, [plate, result]);
    assert.ok(g.attributes.position.count > 0);
    assert.ok([...g.attributes.position.array].every(Number.isFinite));
    g.dispose();
    return result;
  });
  assert.deepEqual(records, before, 'manual instance length must not change catalog records');
  const project = createProject({
    grid: { x: [], y: [] },
    levels: { items: [{ id: 'l', name: 'Plan', elevation: 0 }], active: 'l' },
  });
  project.objects = [plate, ...placed];
  const restored = parseProjectFile(serializeProject(project));
  for (const object of placed) {
    const copy = restored.objects.find((s) => s.id === object.id);
    assert.deepEqual(copy.spec, object.spec);
    assert.deepEqual(copy.accessories, object.accessories);
  }
});

test('manual ISO 4014 thread follows length bands; full thread and insufficient fit remain explicit', () => {
  const catalog = defaultFasteners();
  const partial = catalog.find((s) => s.standard === 'ISO 4014' && s.diameter === 12);
  for (const [length, thread] of [
    [125, 30],
    [126, 36],
    [200, 36],
    [201, 49],
  ])
    assert.equal(withFastenerLength(partial, length).thread.length, thread);
  for (const standard of ['ISO 4017', 'DIN 976-1']) {
    const source = catalog.find((s) => s.standard === standard);
    assert.equal(withFastenerLength(source, 157.5).thread.length, 157.5);
  }
  const short = automaticPlacement(
    {
      id: 'short',
      type: 'fastener',
      spec: withFastenerLength(partial, 5),
      placementMode: 'range',
      lengthMode: 'manual',
      drillDepth: 50,
      assembly: { ...assemblyDefaults(partial), farWasher: true },
      holes: [defaultHoleForSpec(partial, plate.id)],
    },
    [0, 0, -100],
    [0, 0, -99],
    [plate],
  );
  assert.equal(short.spec.length, 5);
  assert.ok(fastenerFitWarnings(short).length);
  for (const length of [0, -1, NaN, Infinity])
    assert.throws(() => withFastenerLength(partial, length));
  for (const spec of catalog.filter((s) => ['wood', 'concrete'].includes(s.kind))) {
    assert.match(spec.name, /modellmall/);
    assert.equal(spec.standard, undefined);
    assert.equal(spec.grade, undefined);
    if (spec.kind === 'concrete')
      assert.deepEqual(withFastenerLength(spec, 150).anchor, spec.anchor);
  }
});
