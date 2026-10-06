import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateFastenerSpec, mergeFasteners } from '../src/fasteners/library.js';
import { fastenerAccessories } from '../src/fasteners/accessories.js';
import { fastenerGeometry, fastenerDisplayTemplate } from '../src/fasteners/geometry.js';
import { validateFastener, fastenerType } from '../src/fasteners/object-type.js';
import { automaticPlacement } from '../src/fasteners/placement.js';
import { partKey } from '../src/part-marks.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';

const bolt = {
  id: 'iso',
  revision: 1,
  kind: 'bolt',
  name: 'Egen ISO 4014 M12',
  standard: 'ISO 4014',
  diameter: 12,
  length: 120,
  thread: { length: 50, pitch: 1.75 },
  head: { kind: 'hex', diameter: 18, height: 7.5 },
  nut: { acrossFlats: 18, thickness: 10 },
  washer: { innerDiameter: 13, outerDiameter: 24, thickness: 2.5 },
};
const rod = {
  ...bolt,
  id: 'rod',
  kind: 'rod',
  name: 'Egen gängstång M12',
  standard: undefined,
  head: undefined,
  thread: { length: 120, pitch: 1.75 },
};
const hardware = [
  { kind: 'nut', offset: 0 },
  { kind: 'washer', offset: 10 },
  { kind: 'washer', offset: 40 },
  { kind: 'nut', offset: 42.5 },
];
const placed = {
  id: 'rod-1',
  type: 'fastener',
  spec: rod,
  start: [0, 0, 0],
  end: [0, 0, 120],
  holes: [],
  accessories: hardware,
  startAllowance: 20,
};

test('standard specifications validate thread rules and product metadata', () => {
  assert.equal(validateFastenerSpec(bolt), bolt);
  assert.throws(() => validateFastenerSpec({ ...bolt, thread: [1] }), /gänguppgifter/);
  assert.doesNotThrow(() =>
    validateFastenerSpec({ ...bolt, standard: 'ISO 4017', thread: { length: 120 } }),
  );
  assert.throws(() => validateFastenerSpec({ ...bolt, thread: { length: 120 } }), /ogängad/);
  assert.throws(() => validateFastenerSpec({ ...bolt, standard: 'ISO 4017' }), /Helgängad/);
  assert.throws(
    () => validateFastenerSpec({ ...bolt, thread: { length: 50, pitch: -1 } }),
    /stigning/,
  );
  assert.throws(() => validateFastenerSpec({ ...bolt, manufacturer: 42 }), /Produktuppgifter/);
  assert.doesNotThrow(() => validateFastenerSpec(rod));
  assert.throws(() => validateFastenerSpec({ ...rod, head: bolt.head }), /sakna huvud/);
});
test('concrete drilling data stays separate from plate clearance dimensions', () => {
  const concrete = {
    ...bolt,
    kind: 'concrete',
    standard: undefined,
    nut: undefined,
    anchor: { embedment: 60, drillDiameter: 10, drillDepth: 70 },
    holeDefaults: { kind: 'clearance', diameter: 14, depth: 20, extent: 'profile' },
  };
  assert.doesNotThrow(() => validateFastenerSpec(concrete));
  assert.throws(
    () => validateFastenerSpec({ ...concrete, anchor: { ...concrete.anchor, drillDepth: 50 } }),
    /Borrdjup/,
  );
  assert.equal(concrete.anchor.drillDiameter, 10);
  assert.equal(concrete.holeDefaults.diameter, 14);
});
test('explicit hardware validates threading, overlaps and available shaft length', () => {
  assert.equal(validateFastener(placed), '');
  assert.match(
    validateFastener({ ...placed, accessories: [{ kind: 'nut', offset: 115 }] }),
    /längd/,
  );
  assert.match(
    validateFastener({
      ...placed,
      accessories: [
        { kind: 'nut', offset: 0 },
        { kind: 'washer', offset: 8 },
      ],
    }),
    /överlappar/,
  );
  assert.match(
    validateFastener({ ...placed, spec: bolt, accessories: [{ kind: 'nut', offset: 60 }] }),
    /gängade delen/,
  );
  assert.match(validateFastener({ ...placed, startAllowance: -1 }), /Utstick/);
  assert.match(
    validateFastener({ ...placed, accessories: Array(33).fill({ kind: 'nut', offset: 0 }) }),
    /32/,
  );
});
test('threaded rod has no head and hardware affects geometry, caches and numbering', () => {
  const bare = { ...placed, accessories: [] };
  const geometry = fastenerGeometry(bare);
  geometry.computeBoundingBox();
  assert.equal(geometry.boundingBox.min.z, 0);
  assert.equal(geometry.boundingBox.max.z, 120);
  const hardwareGeometry = fastenerGeometry(placed);
  hardwareGeometry.computeBoundingBox();
  assert.ok(hardwareGeometry.boundingBox.max.x > geometry.boundingBox.max.x);
  assert.notEqual(fastenerDisplayTemplate(bare).geometry, fastenerDisplayTemplate(placed).geometry);
  assert.notEqual(partKey(bare, []), partKey(placed, []));
  assert.equal(
    partKey(placed, []),
    partKey({ ...placed, accessories: [...hardware].reverse() }, []),
  );
  geometry.dispose();
  hardwareGeometry.dispose();
});
test('automatic rod placement preserves lower and upper hardware and linked holes', () => {
  const plate = {
    id: 'plate',
    type: 'plate',
    frame: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0] },
    polygon: [
      [-50, -50],
      [50, -50],
      [50, 50],
      [-50, 50],
    ],
    thickness: 20,
    side: 'positive',
  };
  const source = {
    ...placed,
    holes: [
      {
        targetId: 'plate',
        kind: 'clearance',
        extent: 'profile',
        offset: 0,
        diameter: 14,
        depth: 20,
      },
    ],
    anchorId: 'plate',
  };
  const result = automaticPlacement(source, [0, 0, -1000], [0, 0, -999], [plate]);
  assert.deepEqual(result.start, [0, 0, -20]);
  assert.equal(result.holes[0].offset, 20);
  assert.deepEqual(result.accessories, hardware);
  assert.equal(validateFastener(result), '');
  assert.throws(
    () =>
      automaticPlacement({ ...source, startAllowance: 110 }, [0, 0, -1000], [0, 0, -999], [plate]),
    /för kort/,
  );
});
test('legacy hardware is read without changing saved shape identity or snapshots', () => {
  const legacy = {
    ...placed,
    spec: { ...bolt, standard: undefined, thread: undefined },
    accessories: undefined,
    nutOffset: 80,
    washers: { head: true, nut: true },
    startAllowance: undefined,
  };
  assert.deepEqual(fastenerAccessories(legacy), [
    { kind: 'nut', offset: 80 },
    { kind: 'washer', offset: 0 },
    { kind: 'washer', offset: 77.5 },
  ]);
  assert.deepEqual(fastenerType.partShape(legacy), {
    type: 'fastener',
    spec: legacy.spec,
    nutOffset: 80,
    washers: { head: true, nut: true },
  });
  const snapshot = structuredClone(legacy);
  fastenerAccessories(legacy)[0].offset = 10;
  assert.deepEqual(legacy, snapshot);
});
test('merging an equivalent library version ignores object key order but catches actual changes', () => {
  const reordered = Object.fromEntries(Object.entries(bolt).reverse());
  assert.equal(mergeFasteners([bolt], [reordered]).length, 1);
  assert.throws(() => mergeFasteners([bolt], [{ ...bolt, thread: { length: 55 } }]), /Konflikt/);
  const merged = mergeFasteners([bolt], [{ ...bolt, revision: 2, thread: { length: 55 } }]);
  merged[1].thread.length = 60;
  assert.equal(bolt.thread.length, 50);
});
test('project roundtrip preserves rod hardware and specification without a library', () => {
  const project = JSON.parse(
    readFileSync(new URL('../examples/forbandstest.lira.json', import.meta.url)),
  ).project;
  project.objects = [placed];
  project.parts = { registry: [], assignments: {} };
  project.drawings = [];
  project.assemblies = [];
  const loaded = parseProjectFile(serializeProject(project));
  assert.deepEqual(loaded.objects[0].accessories, hardware);
  assert.deepEqual(loaded.objects[0].spec, JSON.parse(JSON.stringify(rod)));
});
