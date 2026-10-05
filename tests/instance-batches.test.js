import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { InstanceBatches } from '../src/model/instance-batches.js';
import {
  createObjectMesh,
  updateObjectMeshSelection,
  updateObjectMeshTransparency,
} from '../src/model/object-mesh.js';
import { createFrameExample } from '../src/project/frame-example.js';

const plate = (id, x, color) => ({
  id,
  type: 'plate',
  name: id,
  frame: { origin: [x, 0, 0], u: [1, 0, 0], v: [0, 1, 0] },
  polygon: [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ],
  thickness: 10,
  side: 'positive',
  colorOverride: color,
});
const cleanup = (objects, batches) => {
  batches.clear();
  for (const object of objects)
    object.traverse((part) => {
      part.geometry?.dispose();
      part.material?.dispose();
    });
};

test('shared display preserves per-object colours, selection, visibility and exact picking', () => {
  const sources = [plate('a', 0, '#ff0000'), plate('b', 300, '#0000ff')];
  const objects = sources.map((s) =>
    createObjectMesh(s, { model: sources, selectedIds: new Set() }),
  );
  const batches = new InstanceBatches(new THREE.Scene(), { minimumObjects: 0 });
  batches.rebuild(objects);
  assert.equal(batches.batches.length, 1);
  const batch = batches.batches[0];
  assert.equal(batch.mesh.count, 2);
  assert.equal(batch.lines.geometry.instanceCount, 2);
  const world = objects[1].geometry;
  const ray = new THREE.Raycaster(new THREE.Vector3(350, 50, 100), new THREE.Vector3(0, 0, -1));
  ray.layers.enable(3);
  assert.equal(ray.intersectObjects(objects, false)[0].object.userData.id, 'b');
  const color = new THREE.Color();
  batch.mesh.getColorAt(0, color);
  assert.equal(color.getHex(), 0xff0000);
  updateObjectMeshSelection(objects[1], sources[1], new Set(['b']));
  batches.sync();
  batch.mesh.getColorAt(1, color);
  assert.equal(color.getHex(), 0x359e83);
  assert.equal(objects[1].geometry, world);
  objects[1].visible = false;
  batches.sync();
  const matrix = new THREE.Matrix4();
  batch.mesh.getMatrixAt(1, matrix);
  assert.equal(matrix.determinant(), 0);
  objects[1].visible = true;
  batches.sync();
  batch.mesh.getMatrixAt(1, matrix);
  assert.equal(matrix.elements[12], 300);
  assert.ok(batch.mesh.boundingSphere.containsPoint(new THREE.Vector3(350, 50, 10)));
  const oldGeometry = batch.mesh.geometry;
  let disposed = false;
  oldGeometry.addEventListener('dispose', () => {
    disposed = true;
  });
  batches.rebuild(objects);
  assert.equal(disposed, true);
  assert.equal(batches.batches.length, 1);
  cleanup(objects, batches);
  assert.equal(objects[0].layers.mask, 1);
});

test('prepared parts share their simple body template in both display modes and after hole edits', () => {
  const project = createFrameExample('small', { prepareGeometry: true });
  const sources = project.objects
    .filter((o) => o.profile === 'i' && o.name.includes('X-balk'))
    .slice(0, 2);
  const objects = sources.map((s) =>
    createObjectMesh(s, { model: project.objects, selectedIds: new Set() }),
  );
  const batches = new InstanceBatches(new THREE.Scene(), { minimumObjects: 0 });
  batches.rebuild(objects);
  assert.equal(batches.batches.length, 2);
  assert.equal(
    batches.batches[0].mesh.geometry.attributes.position.count,
    objects[0].geometry.attributes.position.count,
  );
  const a = new THREE.Box3().setFromObject(objects[1]);
  const matrix = new THREE.Matrix4();
  batches.batches[0].mesh.getMatrixAt(1, matrix);
  const b = batches.batches[0].mesh.geometry.boundingBox.clone().applyMatrix4(matrix);
  assert.ok(a.min.distanceTo(b.min) < 0.02);
  assert.ok(a.max.distanceTo(b.max) < 0.02);
  const changed = project.objects.map((o) =>
    o.holes?.some((h) => h.targetId === sources[1].id)
      ? { ...o, holes: o.holes.map((h) => ({ ...h, diameter: 24 })) }
      : o,
  );
  const edited = createObjectMesh(sources[1], { model: changed, selectedIds: new Set() });
  assert.equal(edited.userData.instanceDescriptor, objects[1].userData.instanceDescriptor);
  assert.equal(edited.userData.geometryIdentity, objects[1].userData.geometryIdentity);
  assert.notEqual(edited.children[1].geometry, objects[1].children[1].geometry);
  const bodyBuffer = batches.batches[0].mesh.geometry;
  const markerBuffer = batches.holes.batch.mesh.geometry;
  const markerBefore = markerBuffer.attributes.position.array.slice();
  batches.prepareRebuild();
  batches.update([objects[0], edited]);
  assert.equal(batches.batches[0].mesh.geometry, bodyBuffer);
  assert.equal(batches.holes.batch.mesh.geometry, markerBuffer);
  assert.notDeepEqual(markerBuffer.attributes.position.array, markerBefore);
  assert.equal(batches.batches.length, 2);
  assert.equal(edited.children[1].layers.mask, 1 << 3);
  assert.equal(batches.holes.batch.entries.length, 2);
  const transparent = createObjectMesh(sources[0], {
    model: project.objects,
    selectedIds: new Set(),
    transparentView: true,
  });
  assert.ok(transparent.userData.instanceDescriptor);
  batches.rebuild([objects[0], transparent]);
  batches.setTransparentView(true);
  assert.equal(batches.batches.length, 2);
  assert.equal(batches.batches[0].mesh.material.opacity, 0.3);
  cleanup([...objects, edited, transparent], batches);
});

test('transparent batches sort copies after orbit and preserve colours, hidden objects and geometry across toggles', () => {
  const sources = [plate('near', 0, '#ff0000'), plate('far', 300, '#0000ff')];
  const objects = sources.map((s) =>
    createObjectMesh(s, { model: sources, selectedIds: new Set(), transparentView: true }),
  );
  const geometries = objects.map((o) => o.geometry);
  const batches = new InstanceBatches(new THREE.Scene(), { minimumObjects: 0 });
  batches.rebuild(objects);
  const batch = batches.batches[0];
  const camera = new THREE.OrthographicCamera(-500, 500, 500, -500, 1, 5000);
  camera.position.set(-1000, 50, 100);
  camera.lookAt(100, 50, 0);
  camera.updateMatrixWorld();
  batches.sync(camera);
  assert.equal(batch.entries[0].object.userData.id, 'far');
  const color = new THREE.Color();
  batch.mesh.getColorAt(0, color);
  assert.equal(color.getHex(), 0x0000ff);
  objects[1].visible = false;
  updateObjectMeshSelection(objects[0], sources[0], new Set(['near']));
  camera.position.set(1000, 50, 100);
  camera.lookAt(100, 50, 0);
  camera.updateMatrixWorld();
  batches.sync(camera);
  assert.equal(batch.entries[0].object.userData.id, 'near');
  batch.mesh.getColorAt(0, color);
  assert.equal(color.getHex(), 0x359e83);
  const matrix = new THREE.Matrix4();
  batch.mesh.getMatrixAt(1, matrix);
  assert.equal(matrix.determinant(), 0);
  for (const transparent of [false, true, false]) {
    objects.forEach((o) => updateObjectMeshTransparency(o, transparent));
    batches.setTransparentView(transparent);
    batches.sync(camera);
    assert.equal(batch.mesh.material.transparent, transparent);
    assert.equal(batch.mesh.material.depthWrite, !transparent);
    assert.equal(batch.lines.material.transparent, transparent);
    assert.equal(batch.lines.material.depthWrite, !transparent);
    objects.forEach((o, i) => {
      assert.equal(o.geometry, geometries[i]);
      assert.equal(o.userData.transparentView, transparent);
      assert.equal(o.material.opacity, transparent ? 0.3 : 1);
      assert.ok(o.userData.instanced);
    });
  }
  cleanup(objects, batches);
});

test('incremental placements retain buffers and conservative bounds while submitting only visible copies', () => {
  const sources = [plate('a', 0, '#ff0000'), plate('b', 300, '#0000ff')];
  const objects = sources.map((s) =>
    createObjectMesh(s, { model: sources, selectedIds: new Set() }),
  );
  const batches = new InstanceBatches(new THREE.Scene(), { minimumObjects: 0 });
  batches.rebuild(objects);
  const batch = batches.batches[0];
  const geometry = batch.mesh.geometry;
  objects[0].visible = false;
  batches.sync();
  assert.equal(batch.mesh.count, 1);
  assert.equal(batch.lines.geometry.instanceCount, 1);
  assert.equal(batch.entries[0].object.userData.id, 'b');
  const changed = [plate('a', 3000, '#ff0000'), sources[1]];
  const moved = createObjectMesh(changed[0], { model: changed, selectedIds: new Set() });
  moved.visible = false;
  batches.prepareRebuild();
  batches.update([moved, objects[1]]);
  assert.equal(batch.mesh.geometry, geometry);
  assert.ok(batch.mesh.boundingSphere.containsPoint(new THREE.Vector3(3050, 50, 10)));
  moved.visible = true;
  batches.sync();
  assert.equal(batch.mesh.count, 2);
  const entry = batch.entries.find((e) => e.object.userData.id === 'a');
  const matrix = new THREE.Matrix4();
  batch.mesh.getMatrixAt(entry.index, matrix);
  assert.equal(matrix.elements[12], 3000);
  cleanup([...objects, moved], batches);
});
