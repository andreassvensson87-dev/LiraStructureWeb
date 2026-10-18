import test from 'node:test';
import { preparePickedFasteners } from '../src/fasteners/placement-draft.js';
import { defaultHoleForSpec } from '../src/fasteners/library.js';
import { enclosedSweeps } from '../src/selection.js';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { defaultFasteners } from '../src/fasteners/default-catalog.js';
import { fastenerDisplayTemplate, fastenerGeometry } from '../src/fasteners/geometry.js';
import { objectGeometry, displayGeometry, createSnapGeometryContext } from '../src/model-object.js';
import {
  createObjectMesh,
  updateObjectMeshSelection,
  updateObjectMeshTransparency,
} from '../src/model/object-mesh.js';
import { ObjectFeedback } from '../src/model/object-feedback.js';
import { updateFastenerDetail } from '../src/model/fastener-detail.js';
import { updateDisplayDetail } from '../src/model/display-detail.js';
import { InstanceBatches } from '../src/model/instance-batches.js';
import { exportGeometry } from '../src/ifc/geometry.js';
import { createModelPicking } from '../src/model/ui/model-picking.js';
import { fastenerPerformanceModel } from '../scripts/fastener-performance.js';

const spec = {
  ...defaultFasteners().find((s) => s.standard === 'ISO 4017' && s.diameter === 12),
  length: 80,
  thread: { length: 80, pitch: 1.75 },
};
const screw = (id = 's') => ({
  id,
  type: 'fastener',
  spec,
  start: [100, 200, 0],
  end: [100, 200, 80],
  radial: [1, 0, 0],
  holes: [],
  accessories: [
    { kind: 'washer', offset: 0 },
    { kind: 'washer', offset: 42.5 },
    { kind: 'nut', offset: 45 },
  ],
});
const triangles = (g) => (g.index?.count || g.attributes.position.count) / 3;
const dispose = (object) =>
  object.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });

test('model, hover and preview share intentional contours; manufacturing and IFC keep the full solid', () => {
  const s = screw(),
    before = structuredClone(s);
  const exact = fastenerGeometry(s),
    local = fastenerDisplayTemplate(s),
    overview = fastenerDisplayTemplate(s, true);
  assert.equal(triangles(exact), 1200);
  assert.ok(triangles(local.geometry) < triangles(exact) / 2);
  assert.ok(triangles(overview.geometry) < triangles(local.geometry) / 2);
  assert.ok(local.edges.attributes.position.count / 2 < 200);
  const solid = objectGeometry(s, [s]),
    display = displayGeometry(s, [s]);
  assert.deepEqual(solid.attributes.position.array, exact.attributes.position.array);
  assert.deepEqual(display.boundingBox, solid.boundingBox);
  const exported = exportGeometry(s, [s]);
  assert.equal(exported.triangles.length, 1200, 'IFC never exports the display mesh');
  const model = createObjectMesh(s, { model: [s], selectedIds: new Set() });
  const preview = createObjectMesh(s, { model: [s], selectedIds: new Set(), ghost: true });
  const feedback = new ObjectFeedback(new THREE.Scene());
  feedback.setModel([s]);
  feedback.setHover([s.id]);
  feedback.refresh();
  const hover = feedback.entries.get(s.id);
  assert.deepEqual(
    model.children[0].geometry.attributes.position.array,
    local.edges.attributes.position.array,
  );
  assert.deepEqual(
    preview.children[0].geometry.attributes.position.array,
    local.edges.attributes.position.array,
  );
  assert.deepEqual(
    hover.edges.geometry.attributes.position.array,
    local.edges.attributes.position.array,
  );
  hover.mesh.updateMatrixWorld();
  model.updateMatrixWorld();
  assert.ok(hover.mesh.matrixWorld.equals(model.matrixWorld));
  const proxy = model.userData.overviewMesh;
  assert.ok(
    proxy.matrix.equals(new THREE.Matrix4()),
    'a local fastener proxy cannot apply world placement twice',
  );
  assert.deepEqual(new THREE.Box3().setFromObject(model).min, solid.boundingBox.min);
  assert.deepEqual(new THREE.Box3().setFromObject(model).max, solid.boundingBox.max);
  assert.deepEqual(s, before);
  for (const g of [exact, solid, display]) g.dispose();
  feedback.dispose();
  dispose(model);
  dispose(preview);
});

test('only display keys ignore fitting noise, metadata and accessory ordering', () => {
  const s = screw(),
    a = fastenerDisplayTemplate(s);
  const altered = {
    ...s,
    spec: { ...s.spec, id: 'copy', name: 'Annan beteckning', revision: 2 },
    accessories: s.accessories.map((h) => ({ ...h, offset: h.offset + 0.00001 })).reverse(),
  };
  assert.equal(fastenerDisplayTemplate(altered).geometry, a.geometry);
  const exact = fastenerGeometry(s),
    other = fastenerGeometry(altered);
  assert.notDeepEqual(
    exact.attributes.position.array,
    other.attributes.position.array,
    'export positions are not rounded to share display',
  );
  const longer = { ...s, spec: { ...spec, length: 81 }, end: [100, 200, 81] };
  assert.notEqual(fastenerDisplayTemplate(longer).key, a.key);
  exact.dispose();
  other.dispose();
});

test('hardware without a shaft keeps its visible openings in near and overview display', () => {
  const s = { ...screw(), assembly: { bolt: false } };
  for (const coarse of [false, true]) {
    const g = fastenerDisplayTemplate(s, coarse).geometry;
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    mesh.updateMatrixWorld();
    assert.equal(
      new THREE.Raycaster(new THREE.Vector3(0, 0, -20), new THREE.Vector3(0, 0, 1)).intersectObject(
        mesh,
      ).length,
      0,
    );
    assert.ok(
      new THREE.Raycaster(new THREE.Vector3(9, 0, -20), new THREE.Vector3(0, 0, 1)).intersectObject(
        mesh,
      ).length > 0,
    );
    mesh.material.dispose();
  }
});

test('an unbatched screw remains selectable through its visible coarse proxy', () => {
  const source = screw(),
    model = [source],
    root = new THREE.Group();
  const object = createObjectMesh(source, { model, selectedIds: new Set() });
  root.add(object);
  root.updateMatrixWorld(true);
  const camera = new THREE.OrthographicCamera(-2000, 2000, 2000, -2000, 0.1, 10000);
  camera.position.set(100, 200, 1000);
  camera.lookAt(100, 200, 0);
  camera.updateMatrixWorld();
  updateFastenerDetail([object], camera, 600, new Set());
  assert.equal(object.userData.overviewMesh.userData.detailVisible, true);
  assert.equal(object.userData.instanced, undefined);
  const picking = createModelPicking({
    project: { objects: model },
    ui: {},
    tools: {},
    camera,
    objects: root,
    host: {
      clientWidth: 600,
      clientHeight: 600,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 600 }),
    },
    getRenderedById: () => new Map([[source.id, { source }]]),
    getReferences: () => null,
  });
  picking.ray({ clientX: 300, clientY: 300 });
  assert.equal(picking.selectionHit(), source.id);
  updateObjectMeshTransparency(object, true);
  picking.ray({ clientX: 301.8, clientY: 300 });
  assert.equal(
    picking.selectionHit(),
    source.id,
    'transparent coarse rims use the normal edge-hit path',
  );
  dispose(object);
});

test('detail switching submits one representation per screw, restores selected screws, and retains snap and colour', () => {
  const a = screw('a'),
    b = { ...screw('b'), start: [200, 200, 0], end: [200, 200, 80] },
    sources = [a, b];
  const objects = sources.map((s) =>
    createObjectMesh(s, { model: sources, selectedIds: new Set() }),
  );
  const view = new THREE.OrthographicCamera(-500, 500, 500, -500, 0.1, 10000);
  view.position.set(150, 200, 1000);
  view.lookAt(150, 200, 0);
  view.updateMatrixWorld();
  const batches = new InstanceBatches(new THREE.Scene(), { minimumObjects: 0 });
  batches.rebuild(objects);
  assert.equal(
    objects[0].userData.overviewMesh.parent,
    null,
    'batched proxies do not duplicate the source render subtree',
  );
  const near = batches.batches.find((b) => !b.entries[0].object.userData.overviewProxy),
    coarse = batches.batches.find((b) => b.entries[0].object.userData.overviewProxy);
  const snap = createSnapGeometryContext(sources),
    before = snap.objectCorners(a);
  const frame = (pixels, ids = new Set()) => {
    view.zoom = (pixels * 1000) / (600 * 24);
    view.updateProjectionMatrix();
    updateFastenerDetail(objects, view, 600, ids);
    updateDisplayDetail(objects, view, 600, ids);
    batches.sync(view);
  };
  frame(15);
  assert.equal(near.mesh.count, 2);
  assert.equal(coarse.mesh.count, 0);
  frame(4);
  assert.equal(near.mesh.count, 0);
  assert.equal(coarse.mesh.count, 2);
  frame(10);
  assert.equal(near.mesh.count, 0, 'hysteresis prevents flickering');
  frame(13);
  assert.equal(near.mesh.count, 2);
  assert.equal(coarse.mesh.count, 0);
  frame(1);
  assert.equal(near.mesh.count + coarse.mesh.count, 0);
  frame(1, new Set(['a']));
  assert.equal(near.mesh.count, 1);
  assert.equal(coarse.mesh.count, 0);
  updateObjectMeshSelection(objects[0], a, new Set(['a']));
  updateObjectMeshTransparency(objects[0], true);
  assert.ok(objects[0].userData.overviewMesh.material.color.equals(objects[0].material.color));
  assert.equal(objects[0].userData.overviewMesh.material.opacity, 0.3);
  assert.deepEqual(snap.objectCorners(a), before);
  batches.clear();
  assert.equal(
    objects[0].userData.overviewMesh.parent,
    objects[0],
    'proxies return to their owner before disposal or replacement',
  );
  objects.forEach(dispose);
});

test('the 10000-screw fixture retains 20000 active linked bores and independent complete groups', () => {
  const model = fastenerPerformanceModel(10000),
    screws = model.filter((s) => s.type === 'fastener');
  assert.equal(screws.length, 10000);
  assert.equal(model.length, 10200);
  assert.equal(new Set(screws.map((s) => s.group.id)).size, 100);
  assert.equal(new Set(screws.map((s) => fastenerDisplayTemplate(s).key)).size, 1);
  const ids = new Set(model.map((s) => s.id));
  assert.equal(ids.size, model.length);
  assert.equal(screws.flatMap((s) => s.holes).length, 20000);
  assert.ok(
    screws.every((s) =>
      s.holes.every((h) => h.active && h.layers.length === 1 && ids.has(h.targetId)),
    ),
  );
});

test('holes without hardware keep owner picking, hover and selected contours without creating export solids', () => {
  const part = {
    id: 'part',
    type: 'plate',
    frame: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0] },
    polygon: [
      [0, 0],
      [400, 0],
      [400, 400],
      [0, 400],
    ],
    thickness: 20,
    side: 'positive',
  };
  const batch = preparePickedFasteners(
    {
      type: 'fastener',
      spec,
      placementMode: 'range',
      lengthMode: 'manual',
      assembly: {
        bolt: false,
        nearWasher: false,
        farWasher: false,
        nearNut: false,
        nut: false,
        extraNut: false,
      },
      holes: [{ ...defaultHoleForSpec(spec, part.id), id: 'bore' }],
      anchorId: part.id,
      group: {
        id: 'group',
        shape: 'array',
        rows: 2,
        columns: 2,
        distancesX: [60],
        distancesY: [60],
        rotation: 0,
      },
    },
    { start: [100, 200, 20], xPoint: [200, 200, 20], frame: part.frame, model: [part] },
  );
  const model = [part, ...batch],
    before = structuredClone(model);
  const root = new THREE.Group();
  const meshes = model.map((s) => createObjectMesh(s, { model, selectedIds: new Set() }));
  root.add(...meshes);
  root.updateMatrixWorld(true);
  const camera = new THREE.OrthographicCamera(-150, 150, 150, -150, 0.1, 3000);
  camera.position.set(100, 200, 1000);
  camera.lookAt(100, 200, 0);
  camera.updateMatrixWorld();
  const picking = createModelPicking({
    project: { objects: model },
    ui: {},
    tools: {},
    camera,
    objects: root,
    host: {
      clientWidth: 600,
      clientHeight: 600,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 600 }),
    },
    getRenderedById: () => new Map(model.map((s) => [s.id, { source: s }])),
    getReferences: () => null,
  });
  for (const transparent of [false, true]) {
    for (const mesh of meshes) updateObjectMeshTransparency(mesh, transparent);
    picking.ray({ clientX: 313, clientY: 300 });
    assert.equal(
      picking.selectionHit(),
      batch[0].id,
      'the visible bore rim selects its group owner',
    );
    if (!transparent) {
      picking.ray({ clientX: 300, clientY: 300 });
      assert.equal(
        picking.selectionHit(),
        batch[0].id,
        'the visible hole opening also selects its owner',
      );
      picking.ray({ clientX: 304, clientY: 300 });
      assert.equal(picking.selectionHit(), batch[0].id);
      picking.ray({ clientX: 325, clientY: 300 });
      assert.equal(picking.selectionHit(), part.id, 'material beside the hole remains the part');
    }
  }
  assert.deepEqual(
    enclosedSweeps(batch, camera, 600, 600, { x: 285, y: 285 }, { x: 315, y: 315 }, model),
    [batch[0].id],
    'window selects the complete hole feature',
  );
  assert.deepEqual(
    enclosedSweeps(batch, camera, 600, 600, { x: 305, y: 305 }, { x: 295, y: 295 }, model),
    [batch[0].id],
    'crossing selects the hole opening',
  );
  const inactive = {
    ...batch[0],
    id: 'inactive',
    holes: batch[0].holes.map((h) => ({ ...h, active: false })),
  };
  assert.deepEqual(
    enclosedSweeps([inactive], camera, 600, 600, { x: 0, y: 0 }, { x: 600, y: 600 }, [
      part,
      inactive,
    ]),
    [],
    'inactive holes cannot select an empty owner',
  );
  camera.position.set(600, -500, 800);
  camera.lookAt(100, 200, 20);
  camera.updateMatrixWorld();
  const rim = new THREE.Vector3(106.5, 200, 20).project(camera);
  for (const transparent of [false, true]) {
    for (const mesh of meshes) updateObjectMeshTransparency(mesh, transparent);
    for (const [dx, dy] of [
      [2, 0],
      [-2, 0],
      [0, 2],
      [0, -2],
    ]) {
      picking.ray({ clientX: (rim.x + 1) * 300 + dx, clientY: (1 - rim.y) * 300 + dy });
      assert.equal(
        picking.selectionHit(),
        batch[0].id,
        'an oblique face does not occlude its own rim',
      );
    }
    if (!transparent) {
      const opening = new THREE.Vector3(100, 200, 20).project(camera);
      picking.ray({ clientX: (opening.x + 1) * 300, clientY: (1 - opening.y) * 300 });
      assert.equal(
        picking.selectionHit(),
        batch[0].id,
        'the opening follows its inclined material face',
      );
    }
  }
  const outline = meshes[1].children[0];
  assert.ok(outline.geometry.attributes.position.count > 0);
  updateObjectMeshSelection(meshes[1], batch[0], new Set(batch.map((s) => s.id)));
  assert.equal(outline.material.color.getHex(), 0x145d4d);
  assert.equal(
    outline.material.depthTest,
    false,
    'selected rims remain visible above bore markers',
  );
  const feedback = new ObjectFeedback(new THREE.Scene());
  feedback.setModel(model);
  feedback.setHover([batch[0].id]);
  feedback.refresh();
  assert.deepEqual(
    feedback.entries.get(batch[0].id).edges.geometry.attributes.position.array,
    outline.geometry.attributes.position.array,
  );
  const solid = fastenerGeometry(batch[0]);
  assert.equal(
    solid.attributes.position.count,
    0,
    'holes-only never creates an IFC/manufacturing screw solid',
  );
  assert.deepEqual(model, before);
  assert.ok(batch.every((s) => s.holes.every((h) => h.active)));
  const cover = createObjectMesh(
    { ...part, id: 'cover', frame: { ...part.frame, origin: [0, 0, 100] } },
    { model: [], selectedIds: new Set() },
  );
  cover.updateMatrixWorld(true);
  picking.ray({ clientX: 313, clientY: 300 });
  assert.equal(picking.selectionHit([cover]), 'cover', 'opaque material still occludes bore rims');
  const coveredOpening = new THREE.Vector3(100, 200, 20).project(camera);
  picking.ray({ clientX: (coveredOpening.x + 1) * 300, clientY: (1 - coveredOpening.y) * 300 });
  assert.equal(picking.selectionHit([cover]), 'cover', 'another part occludes the opening too');
  dispose(cover);
  solid.dispose();
  feedback.dispose();
  meshes.forEach(dispose);
});
