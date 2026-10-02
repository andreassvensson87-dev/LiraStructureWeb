import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  validateFastenerSpec,
  defaultHoleForSpec,
  validateFastenerLibrary,
  mergeFasteners,
  latestFasteners,
} from '../src/fasteners/library.js';
import { axisPlacement, holeGeometry } from '../src/fasteners/geometry.js';
import { validateFastener } from '../src/fasteners/object-type.js';
import {
  holesForPart,
  removeFastenerRelations,
  validateFastenerTargets,
} from '../src/fasteners/relations.js';
import { partAxisInterval } from '../src/fasteners/placement.js';
import { geometryForModel, objectAnchors } from '../src/model-object.js';
import { transformObject } from '../src/transform.js';
import { rotateObject } from '../src/rotation.js';
import { applyObjectBatch } from '../src/model/tools/transform-tool.js';
import { partKey, partMatrix, numberParts, partStatus } from '../src/part-marks.js';
import { geometryVectors } from '../src/drawing-vector.js';
import { createProject } from '../src/project/project-state.js';
import { ProjectHistory } from '../src/project/project-history.js';
import { moveGripPoints } from '../src/model/grips.js';
import { partHoleSchedule } from '../src/fasteners/drawing.js';
import { geometryEdges } from '../src/fasteners/edges.js';

const wood = {
  id: 'wood',
  revision: 1,
  kind: 'wood',
  name: 'Egen träskruv 6 × 100',
  diameter: 6,
  length: 100,
  head: { kind: 'countersunk', diameter: 12, height: 4 },
};
const bolt = {
  ...wood,
  id: 'bolt',
  kind: 'bolt',
  diameter: 10,
  head: { kind: 'hex', diameter: 17, height: 6 },
  nut: { acrossFlats: 17, thickness: 8 },
};
const plate = {
  id: 'a',
  type: 'plate',
  name: 'Övre del',
  frame: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0] },
  polygon: [
    [0, 0],
    [200, 0],
    [200, 200],
    [0, 200],
  ],
  thickness: 20,
  side: 'positive',
};
const lower = {
  ...plate,
  id: 'b',
  name: 'Undre del',
  frame: { ...plate.frame, origin: [0, 0, -40] },
  thickness: 40,
};
const screw = {
  id: 's',
  type: 'fastener',
  spec: wood,
  start: [100, 100, 20],
  end: [100, 100, -80],
  anchorId: 'a',
  holes: [
    { targetId: 'a', kind: 'clearance', offset: 0, diameter: 8, depth: 20 },
    { targetId: 'b', kind: 'pilot', offset: 20, diameter: 4, depth: 30 },
  ],
};
const volume = (g) => {
  const p = g.attributes.position,
    index = g.index;
  let sum = 0;
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    const vs = [0, 1, 2].map((n) =>
      new THREE.Vector3().fromBufferAttribute(p, index ? index.getX(i + n) : i + n),
    );
    sum += vs[0].dot(vs[1].cross(vs[2])) / 6;
  }
  return Math.abs(sum);
};
test('library validates both families, versions and detached merge without modifying sources', () => {
  assert.equal(validateFastenerSpec(wood), wood);
  assert.equal(validateFastenerSpec(bolt), bolt);
  assert.throws(() => validateFastenerSpec({ ...bolt, nut: null }), /Mutter|Muttern/);
  assert.throws(() => validateFastenerSpec({ ...wood, diameter: -1 }));
  assert.throws(
    () => validateFastenerLibrary({ schema: 1, fasteners: [wood, wood] }),
    /Duplicerad/,
  );
  assert.throws(() => mergeFasteners([wood], [{ ...wood, length: 120 }]), /Konflikt/);
  const next = mergeFasteners([wood], [{ ...wood, revision: 2, length: 120 }, bolt]);
  assert.equal(latestFasteners(next).length, 2);
  assert.equal(latestFasteners(next).find((s) => s.id === 'wood').length, 120);
  next[0].head.height = 3;
  assert.equal(wood.head.height, 4);
  assert.equal(screw.spec.length, 100);
});
test('placement uses library length and rejects invalid holes, nut positions and targets', () => {
  assert.deepEqual(axisPlacement(wood, [10, 20, 30], [10, 20, 31]).end, [10, 20, 130]);
  assert.throws(() => axisPlacement(wood, [0, 0, 0], [0, 0, 0]));
  assert.equal(validateFastener(screw), '');
  assert.ok(validateFastener({ ...screw, end: [100, 100, -20] }));
  assert.ok(
    validateFastener({
      ...screw,
      holes: [{ ...screw.holes[0], countersink: { diameter: 6, depth: 1 } }],
    }),
  );
  assert.ok(validateFastener({ ...screw, spec: bolt, nutOffset: 99 }));
  assert.equal(validateFastener({ ...screw, spec: bolt, nutOffset: 90 }), '');
  assert.throws(() => validateFastenerTargets(screw, [plate]), /fysiska/);
});
test('a wood screw cuts independent clearance and blind holes and leaves unlinked parts untouched', () => {
  const model = [plate, lower, screw],
    unrelated = { ...plate, id: 'other' };
  const upperGeometry = geometryForModel(plate, model),
    lowerGeometry = geometryForModel(lower, model);
  const original = geometryForModel(plate, [plate]);
  assert.ok(Math.abs(volume(original) - volume(upperGeometry) - Math.PI * 4 ** 2 * 20) < 2);
  assert.ok(Math.abs(200 * 200 * 40 - volume(lowerGeometry) - Math.PI * 2 ** 2 * 30) < 2);
  const g = geometryForModel(unrelated, [...model, unrelated]);
  assert.equal(volume(g), volume(original));
  for (const geometry of [upperGeometry, lowerGeometry, original, g]) geometry.dispose();
});
test('surface intersection finds through depth for inclined and unhit parts', () => {
  const interval = partAxisInterval(screw, plate, [plate, lower]);
  assert.ok(Math.abs(interval.offset) < 1e-6);
  assert.ok(Math.abs(interval.depth - 20) < 1e-6);
  const turned = rotateObject(plate, [0, 0, 0], 'Y', 30),
    fastener = rotateObject(screw, [0, 0, 0], 'Y', 30);
  assert.ok(Math.abs(partAxisInterval(fastener, turned, [turned]).depth - 20) < 0.001);
  assert.throws(
    () =>
      partAxisInterval({ ...screw, start: [400, 400, 20], end: [400, 400, -80] }, plate, [plate]),
    /träffar inte/,
  );
});
test('countersink is one closed cutter and adds removed material above a cylindrical hole', () => {
  const plain = holesForPart(plate, [screw])[0];
  const sunk = { ...plain, countersink: { diameter: 16, depth: 4 } };
  const a = holeGeometry(plain),
    b = holeGeometry(sunk);
  assert.ok(volume(b) > volume(a));
  const modified = { ...screw, holes: [{ ...screw.holes[0], countersink: sunk.countersink }] };
  const ga = geometryForModel(plate, [plate, screw]),
    gb = geometryForModel(plate, [plate, modified]);
  assert.ok(volume(gb) < volume(ga) - 100);
  for (const g of [a, b, ga, gb]) g.dispose();
});
test('hole changes invalidate manufacturing marks and produce singlepart vector contours', () => {
  const model = [plate, lower, screw],
    parts = numberParts(model);
  const changed = { ...screw, holes: screw.holes.map((h) => ({ ...h, diameter: h.diameter + 2 })) };
  assert.equal(partStatus(plate, [plate, lower, changed], parts).valid, false);
  const g = geometryForModel(plate, model);
  g.applyMatrix4(partMatrix(plate));
  const vectors = geometryVectors(g);
  assert.ok(
    vectors.flatMap((v) => v.visible).length > 4,
    'singlepart projection includes the hole outline',
  );
  g.dispose();
  const noHole = { ...screw, holes: screw.holes.map((h) => ({ ...h, kind: 'none' })) };
  assert.equal(partKey(plate, [plate, noHole]), partKey(plate, [plate]));
});
test('reference part transformations carry screws and holes once; joint copies remap their targets', () => {
  const model = [plate, lower, screw],
    moved = transformObject(plate, 'move', [0, 0, 0], [300, 20, 0]);
  const result = applyObjectBatch(model, [moved]).objects;
  assert.deepEqual(result[2].start, [400, 120, 20]);
  assert.equal(partKey(plate, model), partKey(moved, result));
  const turn = applyObjectBatch(model, [rotateObject(plate, [0, 0, 0], 'Y', 30)]).objects;
  objectAnchors(turn[2]).forEach((p, i) => {
    const expected = objectAnchors(rotateObject(screw, [0, 0, 0], 'Y', 30))[i];
    assert.ok(Math.hypot(...p.map((v, j) => v - expected[j])) < 1e-6);
  });
  let id = 0;
  const batch = model.map((s) => transformObject(s, 'copy', [0, 0, 0], [300, 0, 0]));
  const copies = applyObjectBatch(model, batch, {
    copy: true,
    newId: () => `copy${++id}`,
  }).objects.slice(3);
  assert.equal(copies[2].anchorId, copies[0].id);
  assert.deepEqual(
    copies[2].holes.map((h) => h.targetId),
    copies.slice(0, 2).map((s) => s.id),
  );
  assert.equal(partKey(plate, model), partKey(copies[0], copies));
  assert.deepEqual(screw.start, [100, 100, 20]);
});
test('deleting screws restores material; deleting target drops the relation; undo restores the joint', () => {
  const model = [plate, lower, screw];
  const deleted = removeFastenerRelations(model, new Set(['s']));
  assert.equal(partKey(plate, deleted), partKey(plate, [plate]));
  const targetDeleted = removeFastenerRelations(model, new Set(['a']));
  assert.equal(targetDeleted[1].anchorId, 'b');
  assert.deepEqual(
    targetDeleted[1].holes.map((h) => h.targetId),
    ['b'],
  );
  const project = createProject({ grid: {}, levels: {} }),
    history = new ProjectHistory();
  project.objects = structuredClone(model);
  history.checkpoint(project);
  project.objects = deleted;
  const restored = history.undo(project);
  assert.deepEqual(restored.objects, model);
});
test('wood screw and bolt with a bored nut generate finite disposable solid meshes', () => {
  for (const spec of [wood, bolt]) {
    const s = { ...screw, spec, nutOffset: 90 },
      geometry = geometryForModel(s, [s]);
    assert.ok(volume(geometry) > 0);
    assert.ok([...geometry.attributes.position.array].every(Number.isFinite));
    geometry.computeBoundingBox();
    assert.ok(geometry.boundingBox.max.z > 20, 'head extends behind the underside reference');
    geometry.dispose();
  }
});
test('rotation preserves hex head orientation while circular holes keep manufacturing identity', () => {
  const s = { ...screw, spec: bolt, nutOffset: 90 };
  const rotated = rotateObject(s, s.start, [0, 0, 1], 23);
  assert.equal(partKey(plate, [s]), partKey(plate, [rotated]));
  const a = geometryForModel(s, [s]),
    b = geometryForModel(rotated, [rotated]);
  a.translate(-s.start[0], -s.start[1], -s.start[2]);
  a.rotateZ((23 * Math.PI) / 180);
  a.translate(...s.start);
  const pa = a.attributes.position,
    pb = b.attributes.position;
  assert.equal(pa.count, pb.count);
  for (let i = 0; i < pa.count; i++)
    assert.ok(
      new THREE.Vector3()
        .fromBufferAttribute(pa, i)
        .distanceTo(new THREE.Vector3().fromBufferAttribute(pb, i)) < 0.0001,
    );
  a.dispose();
  b.dispose();
});
test('screw grips translate the whole screw and hole schedule reports local centers', () => {
  const [moved] = moveGripPoints([screw], [{ id: 's', kind: 'start' }], [110, 100, 20]);
  assert.equal(validateFastener(moved), '');
  assert.deepEqual(moved.end, [110, 100, -80]);
  const schedule = partHoleSchedule(plate, [screw], partMatrix(plate));
  assert.equal(schedule.length, 1);
  assert.deepEqual(schedule[0].center, [100, 100, 20]);
  assert.match(schedule[0].label, /Ø8/);
});
test('machined beam outlines contain no internal top-face triangulation seams', () => {
  const beam = {
    id: 'beam',
    profile: 'rect',
    width: 200,
    height: 300,
    thickness: 12,
    rotation: 0,
    start: [0, 0, 0],
    end: [3000, 0, 0],
  };
  const fastener = {
    ...screw,
    start: [500, 0, 150],
    end: [500, 0, 50],
    anchorId: 'beam',
    holes: [{ targetId: 'beam', kind: 'pilot', offset: 0, diameter: 6, depth: 30 }],
  };
  const g = geometryForModel(beam, [beam, fastener]),
    edges = geometryEdges(g),
    positions = edges.attributes.position;
  const boundary = (p) =>
    Math.abs(p.x) < 0.01 || Math.abs(p.x - 3000) < 0.01 || Math.abs(Math.abs(p.y) - 100) < 0.01;
  const rim = (p) => Math.abs(Math.hypot(p.x - 500, p.y) - 3) < 0.05;
  for (let i = 0; i < positions.count; i += 2) {
    const a = new THREE.Vector3().fromBufferAttribute(positions, i),
      b = new THREE.Vector3().fromBufferAttribute(positions, i + 1);
    if (Math.abs(a.z - 150) > 0.01 || Math.abs(b.z - 150) > 0.01) continue;
    assert.ok(
      (boundary(a) && boundary(b)) || (rim(a) && rim(b)),
      `Unexpected top seam: ${a.toArray()} -> ${b.toArray()}`,
    );
  }
  edges.dispose();
  g.dispose();
});

test('flat washer dimensions and side selections reject impossible assemblies', () => {
  const spec = { ...bolt, washer: { innerDiameter: 11, outerDiameter: 24, thickness: 2 } };
  const assembly = { ...screw, spec, nutOffset: 90, washers: { head: true, nut: true } };
  assert.equal(validateFastener(assembly), '');
  assert.throws(() =>
    validateFastenerSpec({ ...spec, washer: { ...spec.washer, innerDiameter: 9 } }),
  );
  assert.throws(() =>
    validateFastenerSpec({ ...spec, washer: { ...spec.washer, outerDiameter: 10 } }),
  );
  assert.match(validateFastener({ ...assembly, nutOffset: 3 }), /överlappar/);
  assert.match(validateFastener({ ...assembly, spec: bolt }), /brickmått/);
  const woodWasher = { ...wood, washer: spec.washer };
  assert.match(
    validateFastener({ ...assembly, spec: woodWasher, washers: { head: true, nut: false } }),
    /försänkt|försänk|cylindriskt/,
  );
  assert.match(
    validateFastener({ ...assembly, spec: woodWasher, washers: { head: false, nut: true } }),
    /mutter/,
  );
});
test('each selected washer adds a bored ring with correct volume and follows screw rotation', () => {
  const spec = { ...bolt, washer: { innerDiameter: 11, outerDiameter: 24, thickness: 2 } };
  const base = { ...screw, spec, nutOffset: 90 };
  const g = geometryForModel(base, [base]);
  const ringVolume = Math.PI * (12 ** 2 - 5.5 ** 2) * 2;
  for (const washers of [
    { head: true, nut: false },
    { head: false, nut: true },
    { head: true, nut: true },
  ]) {
    const assembly = { ...base, washers };
    const ga = geometryForModel(assembly, [assembly]);
    const count = Number(washers.head) + Number(washers.nut);
    assert.ok(Math.abs(volume(ga) - volume(g) - count * ringVolume) < count * ringVolume * 0.003);
    const turned = rotateObject(assembly, [0, 0, 0], 'Y', 35);
    const gb = geometryForModel(turned, [turned]);
    assert.ok(Math.abs(volume(gb) - volume(ga)) < 0.1);
    assert.deepEqual(turned.washers, washers);
    ga.dispose();
    gb.dispose();
  }
  g.dispose();
});
test('washer choices affect screw identity and survive history and joint copies', () => {
  const spec = { ...bolt, washer: { innerDiameter: 11, outerDiameter: 24, thickness: 2 } };
  const plain = { ...screw, spec, nutOffset: 90 };
  const assembly = { ...plain, washers: { head: true, nut: true } };
  assert.notEqual(partKey(plain, [plain]), partKey(assembly, [assembly]));
  const model = [plate, lower, assembly];
  const copies = applyObjectBatch(
    model,
    model.map((s) => transformObject(s, 'copy', [0, 0, 0], [300, 0, 0])),
    { copy: true },
  ).objects;
  assert.deepEqual(copies.at(-1).washers, assembly.washers);
  const project = createProject({ grid: {}, levels: {} });
  const history = new ProjectHistory();
  project.objects = model;
  history.checkpoint(project);
  project.objects = [plate, lower, plain];
  assert.deepEqual(history.undo(project).objects[2].washers, assembly.washers);
});

test('library hole defaults validate dimensions and survive export/import without sharing values', () => {
  const spec = {
    ...wood,
    holeDefaults: {
      kind: 'pilot',
      diameter: 4,
      depth: 30,
      countersink: { diameter: 12, depth: 4 },
    },
  };
  validateFastenerSpec(spec);
  const [imported] = validateFastenerLibrary(
    JSON.parse(JSON.stringify({ schema: 1, fasteners: [spec] })),
  );
  assert.deepEqual(imported.holeDefaults, spec.holeDefaults);
  const a = defaultHoleForSpec(imported, 'a');
  const b = defaultHoleForSpec(imported, 'b');
  a.countersink.depth = 2;
  a.diameter = 5;
  assert.equal(b.countersink.depth, 4);
  assert.equal(imported.holeDefaults.diameter, 4);
  assert.deepEqual(defaultHoleForSpec(wood, 'a'), {
    targetId: 'a',
    kind: 'none',
    offset: 0,
    diameter: 6,
    depth: 50,
  });
  for (const holeDefaults of [
    { ...spec.holeDefaults, kind: 'bad' },
    { ...spec.holeDefaults, diameter: 0 },
    { ...spec.holeDefaults, depth: NaN },
    { ...spec.holeDefaults, countersink: { diameter: 4, depth: 2 } },
    { ...spec.holeDefaults, countersink: { diameter: 12, depth: 30 } },
  ])
    assert.throws(() => validateFastenerSpec({ ...wood, holeDefaults }));
});

test('inherited library holes cut parts and retain their values after a new library version', () => {
  const spec = { ...wood, holeDefaults: { kind: 'clearance', diameter: 8, depth: 20 } };
  const placed = { ...screw, spec: structuredClone(spec), holes: [defaultHoleForSpec(spec, 'a')] };
  assert.equal(validateFastener(placed), '');
  const plain = geometryForModel(plate, [plate]);
  const drilled = geometryForModel(plate, [plate, placed]);
  assert.ok(volume(drilled) < volume(plain) - 900);
  const next = { ...spec, revision: 2, holeDefaults: { kind: 'pilot', diameter: 4, depth: 10 } };
  const records = mergeFasteners([spec], [next]);
  assert.equal(latestFasteners(records)[0].holeDefaults.diameter, 4);
  assert.equal(placed.holes[0].diameter, 8);
  assert.equal(placed.spec.holeDefaults.kind, 'clearance');
  plain.dispose();
  drilled.dispose();
});
