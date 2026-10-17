import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { updateCameraDepth } from '../src/model/camera-depth.js';

test('model depth preserves sub-millimetre overlays without changing framing during orbit or pan', () => {
  const camera = new THREE.OrthographicCamera(-500, 500, 400, -400, 1, 1e8);
  camera.up.set(0, 0, 1);
  const bounds = new THREE.Box3(
    new THREE.Vector3(-150, -100, -95),
    new THREE.Vector3(150, 100, 95),
  );
  for (const direction of [
    [1, -1, 1],
    [0, 0, 1],
    [-1, 1, -1],
  ]) {
    camera.position.fromArray(direction).normalize().multiplyScalar(10000);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const before = new THREE.Vector3(80, 60, 95).project(camera);
    updateCameraDepth(camera, bounds);
    const after = new THREE.Vector3(80, 60, 95).project(camera);
    assert.equal(after.x, before.x);
    assert.equal(after.y, before.y);
    assert.ok(
      (camera.far - camera.near) / 2 ** 24 < 0.0001,
      'no millimetre-sized depth steps at holes',
    );
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z]) {
          const projected = new THREE.Vector3(x, y, z).project(camera);
          assert.ok(
            projected.z > -1 && projected.z < 1,
            'all content remains inside depth clipping',
          );
        }
  }
});

test('depth includes distant reference bounds and previews without changing geometry or saved bounds', () => {
  const camera = new THREE.OrthographicCamera(-1000, 1000, 1000, -1000, 1, 1e8);
  camera.position.set(0, 0, 10000);
  camera.lookAt(0, 0, 0);
  const bounds = new THREE.Box3(
    new THREE.Vector3(-100, -100, -100),
    new THREE.Vector3(100, 100, 100),
  );
  const original = bounds.clone();
  const preview = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100));
  preview.position.set(0, 0, -500000);
  const vertices = preview.geometry.attributes.position.array.slice();
  updateCameraDepth(camera, bounds, preview);
  assert.ok(new THREE.Vector3(0, 0, -500050).project(camera).z < 1);
  assert.ok(bounds.equals(original));
  assert.deepEqual(preview.geometry.attributes.position.array, vertices);
  const wide = camera.far - camera.near;
  updateCameraDepth(camera, bounds);
  assert.ok(camera.far - camera.near < wide / 100);
  bounds.expandByPoint(new THREE.Vector3(0, 0, -2000000));
  updateCameraDepth(camera, bounds);
  assert.ok(new THREE.Vector3(0, 0, -2000000).project(camera).z < 1);
  assert.ok(Number.isFinite(camera.projectionMatrix.elements[10]));
  preview.geometry.dispose();
  preview.material.dispose();
});
