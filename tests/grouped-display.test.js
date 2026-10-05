import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createObjectMesh } from '../src/model/object-mesh.js';
import { InstanceBatches } from '../src/model/instance-batches.js';
import { updateFastenerDetail } from '../src/model/fastener-detail.js';
import { fastenerGeometry, fastenerDisplayTemplate } from '../src/fasteners/geometry.js';
import {
  createDisplayGeometryContext,
  displayGeometryIdentityReader,
  selectionGeometryReader,
} from '../src/model-object.js';
import { SnapIndex } from '../src/model/snap-index.js';
import { enclosedSweeps } from '../src/selection.js';

const joint = () =>
  JSON.parse(readFileSync(new URL('../examples/forbandstest.lira.json', import.meta.url))).project
    .objects;
const cleanup = (objects, batches) => {
  batches.clear();
  objects.forEach((object) =>
    object.traverse((child) => {
      child.geometry?.dispose();
      child.material?.dispose();
    }),
  );
};

test('rotated screw display and snap bounds use shared templates while world geometry stays correct', () => {
  const source = joint().find((s) => s.type === 'fastener');
  const screw = {
    ...source,
    id: 'rotated-lazy',
    start: [4000, 3000, 2000],
    end: [4000 + source.spec.length / Math.sqrt(2), 3000 + source.spec.length / Math.sqrt(2), 2000],
    radial: [0, 0, 1],
    holes: [],
  };
  const model = [screw],
    context = createDisplayGeometryContext(model);
  const mesh = createObjectMesh(screw, { model, geometryContext: context, selectedIds: new Set() });
  const template = fastenerDisplayTemplate(screw);
  assert.equal(
    mesh.geometry.attributes.position.array,
    template.geometry.attributes.position.array,
  );
  assert.equal(displayGeometryIdentityReader(model)(screw), template.geometry);
  const reader = selectionGeometryReader(model),
    bounds = reader.bounds(screw);
  const camera = new THREE.OrthographicCamera(-500, 500, 500, -500, 1, 10000);
  camera.position.set(4000, 3000, 5000);
  camera.lookAt(4000, 3000, 2000);
  camera.updateMatrixWorld();
  const clone = template.geometry.clone;
  template.geometry.clone = () => {
    throw new Error('Broad-phase selection and snap must not copy screw vertices');
  };
  try {
    assert.deepEqual(
      enclosedSweeps(model, camera, 1000, 1000, { x: 0, y: 0 }, { x: 1000, y: 1000 }),
      [screw.id],
    );
    assert.deepEqual(
      enclosedSweeps(model, camera, 1000, 1000, { x: 10, y: 10 }, { x: 100, y: 100 }),
      [],
    );
    assert.ok(new SnapIndex(model).query(camera, 1000, 1000, [500, 500]).includes(screw));
  } finally {
    template.geometry.clone = clone;
  }
  const exact = fastenerGeometry(screw),
    world = reader(screw);
  assert.deepEqual(world.attributes.position.array, exact.attributes.position.array);
  const point = new THREE.Vector3();
  for (let i = 0; i < world.attributes.position.count; i++) {
    point.fromBufferAttribute(world.attributes.position, i);
    assert.ok(bounds.clone().expandByScalar(0.001).containsPoint(point));
  }
  assert.deepEqual(
    enclosedSweeps(model, camera, 1000, 1000, { x: 505, y: 480 }, { x: 495, y: 520 }),
    [screw.id],
  );
  assert.equal(displayGeometryIdentityReader(model)(screw), template.geometry);
  exact.dispose();
  cleanup([mesh], new InstanceBatches(new THREE.Scene()));
});

test('ordinary cuts invalidate shared screw display and removing them restores the template', () => {
  const source = joint().find((s) => s.type === 'fastener');
  const screw = { ...source, id: 'cut-screw', holes: [] };
  const original = createObjectMesh(screw, { model: [screw], selectedIds: new Set() });
  const cut = {
    id: 'remote-cut',
    type: 'polygoncut',
    targets: [screw.id],
    frame: { origin: [100000, 100000, 100000], u: [1, 0, 0], v: [0, 1, 0] },
    polygon: [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ],
    thickness: 100,
    side: 'positive',
  };
  const model = [screw, cut],
    context = createDisplayGeometryContext(model);
  assert.equal(context.fastenerTemplate(screw), null);
  assert.notEqual(displayGeometryIdentityReader(model)(screw), original.userData.geometryIdentity);
  const changed = createObjectMesh(screw, {
    model,
    geometryContext: context,
    selectedIds: new Set(),
  });
  assert.equal(changed.userData.instanceDescriptor, null);
  assert.ok(changed.geometry.attributes.position.count > 0);
  assert.equal(
    createDisplayGeometryContext([screw]).fastenerTemplate(screw).geometry,
    fastenerDisplayTemplate(screw).geometry,
  );
  cleanup([original, changed], new InstanceBatches(new THREE.Scene()));
});

test('identical hardware shares immutable arrays with independent disposal and correct world placement', () => {
  const screw = joint().find((s) => s.type === 'fastener');
  const copy = {
    ...screw,
    id: 'copy',
    start: screw.start.map((n, i) => n + (i === 0 ? 1000 : 0)),
    end: screw.end.map((n, i) => n + (i === 0 ? 1000 : 0)),
    holes: [],
  };
  const sources = [screw, copy];
  const objects = sources.map((s) =>
    createObjectMesh(s, { model: sources, selectedIds: new Set() }),
  );
  assert.notEqual(objects[0].geometry, objects[1].geometry);
  assert.notEqual(objects[0].geometry.attributes.position, objects[1].geometry.attributes.position);
  assert.equal(
    objects[0].geometry.attributes.position.array,
    objects[1].geometry.attributes.position.array,
  );
  assert.equal(
    objects[0].children[0].geometry.attributes.position.array,
    objects[1].children[0].geometry.attributes.position.array,
  );
  for (let i = 0; i < sources.length; i++) {
    const exact = fastenerGeometry(sources[i]);
    exact.computeBoundingBox();
    const world = new THREE.Box3().setFromObject(objects[i]);
    assert.ok(world.min.distanceTo(exact.boundingBox.min) < 0.01);
    assert.ok(world.max.distanceTo(exact.boundingBox.max) < 0.01);
    exact.dispose();
  }
  const different = createObjectMesh(
    { ...copy, washers: { head: !copy.washers?.head, nut: false } },
    { model: sources, selectedIds: new Set() },
  );
  assert.notEqual(
    different.geometry.attributes.position.array,
    objects[0].geometry.attributes.position.array,
  );
  let disposed = false;
  objects[1].geometry.addEventListener('dispose', () => {
    disposed = true;
  });
  objects[0].geometry.dispose();
  assert.equal(disposed, false);
  const batches = new InstanceBatches(new THREE.Scene(), { minimumObjects: 0 });
  cleanup([...objects, different], batches);
});

test('instanced hardware keeps picking, selection and detail visibility when zooming and rebuilding', () => {
  const screw = joint().find((s) => s.type === 'fastener');
  const sources = [
    screw,
    { ...screw, id: 'copy', start: [0, 0, 0], end: [0, 0, screw.spec.length], holes: [] },
  ];
  const objects = sources.map((s) =>
    createObjectMesh(s, { model: sources, selectedIds: new Set() }),
  );
  const batches = new InstanceBatches(new THREE.Scene(), { minimumObjects: 0 });
  batches.rebuild(objects);
  assert.equal(batches.batches.length, 1);
  const camera = new THREE.OrthographicCamera(-50000, 50000, 50000, -50000, 1, 1000000);
  const matrix = new THREE.Matrix4();
  updateFastenerDetail(objects, camera, 600, new Set());
  batches.sync(camera);
  batches.batches[0].mesh.getMatrixAt(
    batches.batches[0].entries.find((entry) => entry.object.userData.id === 'copy').index,
    matrix,
  );
  assert.equal(matrix.determinant(), 0);
  assert.equal(objects[1].layers.mask, 1 << 2);
  assert.equal(batches.batches[0].mesh.count, 0);
  updateFastenerDetail(objects, camera, 600, new Set(['copy']));
  batches.sync(camera);
  batches.batches[0].mesh.getMatrixAt(
    batches.batches[0].entries.find((entry) => entry.object.userData.id === 'copy').index,
    matrix,
  );
  assert.ok(matrix.determinant() > 0.99);
  assert.equal(objects[1].layers.mask, 1 << 3);
  assert.equal(batches.batches[0].mesh.count, 1);
  assert.equal(batches.batches[0].lines.geometry.instanceCount, 1);
  assert.equal(camera.layers.test(objects[1].layers), false, 'original must not be drawn twice');
  const ray = new THREE.Raycaster(
    new THREE.Vector3(100, 0, screw.spec.length / 2),
    new THREE.Vector3(-1, 0, 0),
  );
  ray.layers.enable(3);
  assert.ok(ray.intersectObject(objects[1], false).length > 0);
  objects[1].visible = false;
  batches.sync();
  batches.batches[0].mesh.getMatrixAt(
    batches.batches[0].entries.find((entry) => entry.object.userData.id === 'copy').index,
    matrix,
  );
  assert.equal(matrix.determinant(), 0);
  objects[1].visible = true;
  camera.zoom = 10;
  updateFastenerDetail(objects, camera, 600, new Set());
  batches.rebuild(objects);
  batches.sync();
  batches.batches[0].mesh.getMatrixAt(
    batches.batches[0].entries.find((entry) => entry.object.userData.id === 'copy').index,
    matrix,
  );
  assert.ok(matrix.determinant() > 0.99);
  cleanup(objects, batches);
});

test('grouped bore markers preserve every vertex, hidden ranges and depth order across transparency toggles', () => {
  const model = joint();
  const context = createDisplayGeometryContext(model);
  const objects = model
    .slice(0, 2)
    .map((s) => createObjectMesh(s, { model, selectedIds: new Set(), geometryContext: context }));
  const batches = new InstanceBatches(new THREE.Scene(), { minimumObjects: 0 });
  batches.rebuild(objects);
  const batch = batches.holes.batch;
  assert.equal(batch.entries.length, 2);
  const positions = batch.mesh.geometry.attributes.position.array;
  for (const entry of batch.entries) {
    assert.deepEqual(
      positions.slice(entry.start * 3, (entry.start + entry.count) * 3),
      entry.marker.geometry.attributes.position.array,
    );
    assert.equal(entry.marker.layers.mask, 1 << 3);
  }
  const entry = batch.entries[1];
  objects[1].visible = false;
  batches.sync();
  assert.ok(
    batch.mesh.geometry.index.array
      .slice(entry.offset, entry.offset + entry.count)
      .every((i) => i === entry.start),
  );
  objects[1].visible = true;
  batches.sync();
  assert.equal(batch.mesh.geometry.index.array[entry.offset + 1], entry.start + 1);
  const camera = new THREE.OrthographicCamera(-500, 500, 500, -500, 1, 1e6);
  batches.setTransparentView(true);
  camera.position.set(0, 0, 10000);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  batches.sync(camera);
  assert.ok(batch.entries[0].depth <= batch.entries[1].depth);
  const first = batch.entries[0];
  camera.position.set(0, 0, -10000);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  batches.sync(camera);
  assert.notEqual(batch.entries[0], first);
  assert.equal(batch.mesh.material.opacity, 0.65);
  assert.equal(batch.mesh.material.depthWrite, false);
  batches.setTransparentView(false);
  assert.equal(batch.mesh.material.opacity, 1);
  assert.equal(batch.mesh.material.depthWrite, true);
  assert.equal(batch.mesh.geometry.attributes.position.array, positions);
  cleanup(objects, batches);
  assert.equal(objects[1].children[1].layers.mask, 1);
});
