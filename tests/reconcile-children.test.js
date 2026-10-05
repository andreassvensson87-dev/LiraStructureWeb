import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { reconcileChildren } from '../src/model/reconcile-children.js';

test('replacing an edited mesh preserves untouched scene attachments and model order', () => {
  const group = new THREE.Group();
  const a = new THREE.Object3D(),
    b = new THREE.Object3D(),
    c = new THREE.Object3D(),
    edited = new THREE.Object3D();
  group.add(a, b, c);
  const added = [],
    removed = [];
  group.addEventListener('childadded', (event) => added.push(event.child));
  group.addEventListener('childremoved', (event) => removed.push(event.child));
  reconcileChildren(group, [a, edited, c]);
  assert.deepEqual(added, [edited]);
  assert.deepEqual(removed, [b]);
  assert.equal(b.parent, null);
  assert.deepEqual(group.children, [a, edited, c]);
  assert.ok(group.children.every((child) => child.parent === group));
  reconcileChildren(group, [c, edited, a]);
  assert.deepEqual(group.children, [c, edited, a]);
  assert.equal(added.length, 1);
  assert.equal(removed.length, 1);
});

test('moved replacements, undo, redo and deletion remain correctly placed and pickable', () => {
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  group.position.x = 100;
  scene.add(group);
  const geometry = new THREE.BoxGeometry(10, 10, 10);
  const material = new THREE.MeshBasicMaterial();
  const original = new THREE.Mesh(geometry, material);
  const moved = new THREE.Mesh(geometry, material);
  moved.position.x = 30;
  const ray = new THREE.Raycaster();
  for (const [mesh, x] of [
    [original, 100],
    [moved, 130],
    [original, 100],
    [moved, 130],
  ]) {
    reconcileChildren(group, [mesh]);
    scene.updateMatrixWorld(true);
    ray.set(new THREE.Vector3(x, 0, 100), new THREE.Vector3(0, 0, -1));
    assert.equal(ray.intersectObject(group, true)[0].object, mesh);
    assert.equal(mesh.parent, group);
    assert.equal((mesh === original ? moved : original).parent, null);
  }
  reconcileChildren(group, []);
  assert.equal(moved.parent, null);
  assert.equal(ray.intersectObject(group, true).length, 0);
  geometry.dispose();
  material.dispose();
});
