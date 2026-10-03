import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { InstanceBatches } from '../src/model/instance-batches.js';
import { createObjectMesh, updateObjectMeshSelection } from '../src/model/object-mesh.js';
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

test('prepared drilled copies share their exact template; edited holes and transparent meshes fall back', () => {
  const project = createFrameExample('small', { prepareGeometry: true });
  const sources = project.objects
    .filter((o) => o.profile === 'i' && o.name.includes('X-balk'))
    .slice(0, 2);
  const objects = sources.map((s) =>
    createObjectMesh(s, { model: project.objects, selectedIds: new Set() }),
  );
  const batches = new InstanceBatches(new THREE.Scene(), { minimumObjects: 0 });
  batches.rebuild(objects);
  assert.equal(batches.batches.length, 1);
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
  assert.equal(edited.userData.instanceDescriptor, null);
  batches.rebuild([objects[0], edited]);
  assert.equal(batches.batches.length, 0);
  const transparent = createObjectMesh(sources[0], {
    model: project.objects,
    selectedIds: new Set(),
    transparentView: true,
  });
  assert.equal(transparent.userData.instanceDescriptor, undefined);
  cleanup([...objects, edited, transparent], batches);
});
