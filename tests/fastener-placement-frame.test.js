import test from 'node:test';
import * as THREE from 'three';
import { createModelPicking } from '../src/model/ui/model-picking.js';
import { createObjectMesh } from '../src/model/object-mesh.js';
import assert from 'node:assert/strict';
import { defaultFasteners } from '../src/fasteners/default-catalog.js';
import { defaultHoleForSpec } from '../src/fasteners/library.js';
import { assemblyDefaults } from '../src/fasteners/assembly.js';
import {
  fastenerLayoutFromPoints,
  fastenerPlaneFromSurface,
  applyFastenerLayout,
  layoutForFastener,
} from '../src/fasteners/placement-frame.js';
import {
  preparePickedFasteners,
  prepareFastenerPlacement,
} from '../src/fasteners/placement-draft.js';
import { fastenerFrame } from '../src/fasteners/geometry.js';
import { groupPoint, validateFastenerGroups } from '../src/fasteners/group-data.js';
import { transformObject } from '../src/transform.js';
import { rotateObject } from '../src/rotation.js';
import { fastenerGroupBatch } from '../src/fasteners/groups.js';
import { withFastenerLength } from '../src/fasteners/manual-length.js';
import { createProject } from '../src/project/project-state.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
import { updateAutomaticJoints } from '../src/fasteners/update-joints.js';
import { validateFastener } from '../src/fasteners/object-type.js';
const frame = { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0] };
const plate = {
  id: 'p',
  type: 'plate',
  frame,
  polygon: [
    [-200, -200],
    [400, -200],
    [400, 400],
    [-200, 400],
  ],
  thickness: 20,
  side: 'positive',
};
const spec = defaultFasteners().find((s) => s.standard === 'ISO 4017' && s.diameter === 12);
const draft = {
  type: 'fastener',
  spec: withFastenerLength(spec, 93.5),
  placementMode: 'range',
  lengthMode: 'manual',
  drillDepth: 100,
  nutOffset: 80,
  assembly: { ...assemblyDefaults(spec), nearWasher: true, farWasher: true },
  holes: [{ ...defaultHoleForSpec(spec, 'p'), id: 'h' }],
  anchorId: 'p',
};
const grid = {
  id: 'g',
  shape: 'array',
  rows: 2,
  columns: 3,
  distancesX: [60, 80],
  distancesY: [50],
  rotation: 0,
};
const close = (a, b) => {
  a = a.toArray?.() || a;
  b = b.toArray?.() || b;
  a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-6, `${a} ≠ ${b}`));
};

test('two picked points orient the pattern X axis, not shaft length or axis', () => {
  const before = structuredClone(draft);
  const batch = preparePickedFasteners(
    { ...draft, group: grid },
    { start: [0, 0, 20], xPoint: [100, 0, 50], frame, model: [plate] },
  );
  assert.equal(batch.length, 6);
  close(batch[0].layout.frame.u, [1, 0, 0]);
  close(fastenerFrame(batch[0]).z, [0, 0, -1]);
  close(groupPoint(batch[0].group, 1, 2), [140, 50, 20]);
  assert.equal(batch[0].spec.length, 93.5);
  assert.equal(batch[0].holes[0].active, true);
  assert.equal(batch[0].accessories.length, 3);
  assert.equal(validateFastener(batch[0]), '');
  validateFastenerGroups(batch);
  assert.deepEqual(draft, before);
  const differentlyPicked = preparePickedFasteners(draft, {
    start: [0, 0, 20],
    xPoint: [1000, 0, 20],
    frame,
    model: [plate],
  })[0];
  assert.equal(differentlyPicked.spec.length, 93.5);
  close(fastenerFrame(differentlyPicked).z, [0, 0, -1]);
});

test('inclined plane, offsets, shaft angle and flip share one layout calculation', () => {
  const inclined = { origin: [0, 0, 0], u: [0.8, 0, 0.6], v: [0, 1, 0] };
  const layout = fastenerLayoutFromPoints([10, 20, 30], [90, 20, 90], inclined);
  layout.offset = [100, 50, 20];
  let s = applyFastenerLayout({ ...draft, layout, group: grid });
  close(s.group.origin, [78, 70, 106]);
  close(fastenerFrame(s).z, [0.6, 0, -0.8]);
  const locations = Array.from({ length: 6 }, (_, i) =>
    groupPoint(s.group, Math.floor(i / 3), i % 3),
  );
  layout.reversed = true;
  s = applyFastenerLayout({ ...draft, layout, group: grid });
  close(fastenerFrame(s).z, [-0.6, 0, 0.8]);
  locations.forEach((p, i) => close(groupPoint(s.group, Math.floor(i / 3), i % 3), p));
  layout.reversed = false;
  layout.rotation = 90;
  s = applyFastenerLayout({ ...draft, layout, group: grid });
  close(fastenerFrame(s).z, [0, 1, 0]);
  assert.equal(validateFastener({ ...s, group: { ...s.group, row: 0, column: 0 } }), '');
});

test('modified patterns retain existing screw and bore IDs, and flipping keeps hole locations', () => {
  const source = preparePickedFasteners(
    { ...draft, group: grid },
    { start: [0, 0, 20], xPoint: [100, 0, 20], frame, model: [plate] },
  );
  const changed = prepareFastenerPlacement(
    {
      ...source[0],
      layout: { ...source[0].layout, reversed: true },
      group: { ...source[0].group, distancesX: [70, 90] },
    },
    { model: [plate, ...source] },
  ).batch;
  assert.equal(changed.length, 6);
  source.forEach((s, i) => {
    assert.equal(changed[i].id, s.id);
    assert.equal(changed[i].holes[0].id, s.holes[0].id);
    close(fastenerFrame(changed[i]).z, [0, 0, 1]);
    assert.equal(changed[i].holes[0].active, true);
  });
  const flipped = prepareFastenerPlacement(
    { ...source[0], layout: { ...source[0].layout, reversed: true } },
    { model: [plate, ...source] },
  ).batch;
  source.forEach((s, i) =>
    close(
      groupPoint(flipped[i].group, s.group.row, s.group.column),
      groupPoint(s.group, s.group.row, s.group.column),
    ),
  );
});

test('layout survives transforms, fitting after part edits and project reload', () => {
  const batch = preparePickedFasteners(
    { ...draft, group: grid },
    { start: [0, 0, 20], xPoint: [100, 0, 20], frame, model: [plate] },
  );
  const moved = transformObject(batch[0], 'move', [0, 0, 0], [100, 20, 5]);
  close(moved.layout.frame.origin, [100, 20, 25]);
  const rotated = rotateObject(batch[0], [0, 0, 0], [0, 1, 0], 90);
  close(rotated.layout.frame.origin, [20, 0, 0]);
  close(rotated.layout.frame.u, [0, 0, -1]);
  const refitted = updateAutomaticJoints(
    [plate, ...batch],
    [{ ...plate, thickness: 35 }, ...batch],
  );
  const recreated = prepareFastenerPlacement(refitted[1], { model: refitted }).batch;
  recreated.forEach((s) => assert.equal(s.spec.length, 93.5));
  const project = createProject({
    grid: { x: [], y: [] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  project.objects = refitted;
  const restored = parseProjectFile(serializeProject(project));
  assert.deepEqual(restored.objects[1].layout, batch[0].layout);
  const ref = layoutForFastener(restored.objects[1]);
  assert.deepEqual(ref, batch[0].layout);
});

test('invalid plane directions, layout edits and patterns reject without mutating inputs', () => {
  for (const end of [
    [0, 0, 20],
    [0, 0, 100],
  ])
    assert.throws(() => fastenerLayoutFromPoints([0, 0, 20], end, frame), /X-riktning/);
  const layout = fastenerLayoutFromPoints([0, 0, 20], [100, 0, 20], frame);
  for (const malformed of [
    { ...layout, offset: [NaN, 0, 0] },
    { ...layout, rotation: Infinity },
    { ...layout, searchLength: -1 },
    { ...layout, frame: { ...frame, u: [2, 0, 0] } },
  ])
    assert.throws(() =>
      prepareFastenerPlacement({ ...draft, layout: malformed }, { model: [plate] }),
    );
  const bad = { ...draft, layout, group: { ...grid, distancesX: [0, 80] } };
  const before = structuredClone(bad);
  assert.throws(() => prepareFastenerPlacement(bad, { model: [plate] }));
  assert.deepEqual(bad, before);
  const axial = { ...draft, id: 'axis', start: [0, 0, 20], end: [0, 0, -73.5] };
  const adapted = applyFastenerLayout({ ...axial, layout: layoutForFastener(axial) });
  close(fastenerFrame(adapted).z, [0, 0, -1]);
  assert.equal(
    fastenerGroupBatch({ ...applyFastenerLayout({ ...draft, layout, group: grid }) }, [plate])
      .length,
    6,
  );
});

test('picked vertical material face places the group and bores in that face without changing the workplane', (t) => {
  const prior = globalThis.document;
  globalThis.document = { getElementById: () => ({ textContent: '' }) };
  t.after(() => {
    globalThis.document = prior;
  });
  const standing = { ...plate, frame: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 0, 1] } };
  const project = createProject({
    grid: { x: [], y: [] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  project.objects = [standing];
  for (const key of Object.keys(project.snap)) project.snap[key] = false;
  const sourceFrame = structuredClone(frame);
  const tools = { first: null, operation: { mode: 'fastenerCreate', draft, frame: sourceFrame } };
  const root = new THREE.Group();
  const mesh = createObjectMesh(standing, { model: [standing], selectedIds: new Set() });
  root.add(mesh);
  root.updateMatrixWorld(true);
  t.after(() =>
    mesh.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    }),
  );
  const camera = new THREE.OrthographicCamera(-300, 300, 300, -300, 0.1, 3000);
  camera.up.set(0, 0, 1);
  camera.position.set(100, -1000, 100);
  camera.lookAt(100, 0, 100);
  camera.updateMatrixWorld();
  const picking = createModelPicking({
    project,
    tools,
    ui: { selectedIds: new Set() },
    camera,
    objects: root,
    host: {
      clientWidth: 600,
      clientHeight: 600,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 600 }),
    },
    isVisible: () => true,
    getSnapIndex: () => null,
    getReferences: () => null,
    updateSnapOverlay() {},
  });
  const start = picking.point({ clientX: 300, clientY: 300 });
  close(start, [100, -20, 100]);
  const picked = tools.operation.surfaceFrame;
  close(picked.u, [1, 0, 0]);
  close(picked.v, [0, 0, 1]);
  assert.deepEqual(sourceFrame, frame, 'hover cannot modify the active workplane');
  const batch = preparePickedFasteners(
    { ...draft, group: grid },
    {
      start,
      xPoint: [200, -20, 100],
      frame: picked,
      model: [standing],
    },
  );
  assert.equal(batch.length, 6);
  for (const screw of batch) {
    close(fastenerFrame(screw).z, [0, 1, 0]);
    assert.equal(screw.holes[0].active, true);
    assert.equal(validateFastener(screw), '');
  }
  validateFastenerGroups(batch);
  tools.operation.draft = { ...draft, holes: [{ ...draft.holes[0], targetId: 'other' }] };
  picking.point({ clientX: 300, clientY: 300 });
  assert.equal(tools.operation.surfaceFrame, undefined);
});

test('surface plane keeps a valid axis for end faces and inclined faces', () => {
  for (const normal of [
    [1, 0, 0],
    [0, 0, 1],
    [0.6, 0.8, 0],
  ]) {
    const surface = fastenerPlaneFromSurface([10, 20, 30], normal, frame);
    const layout = fastenerLayoutFromPoints(
      surface.origin,
      surface.origin.map((v, i) => v + surface.u[i] * 100),
      surface,
    );
    close(new THREE.Vector3(...layout.frame.u).cross(new THREE.Vector3(...layout.frame.v)), normal);
  }
});
