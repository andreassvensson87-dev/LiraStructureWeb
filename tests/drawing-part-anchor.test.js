import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { pointOnPart, partAnchor } from '../src/drawing-part-anchor.js';
test('anchors must hit the referenced object within the drawing depth', () => {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(100, 100, 100),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  );
  assert.equal(pointOnPart(mesh, [0, 0], -100, 100), true);
  assert.equal(pointOnPart(mesh, [100, 0], -100, 100), false);
  assert.equal(pointOnPart(mesh, [0, 0], 200, 300), false);
  assert.deepEqual(partAnchor(mesh, -100, 100), [0, 0]);
});
test('automatic anchor avoids empty space inside the bounding rectangle', () => {
  const g = new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [-10, 0, 0, -5, 0, 0, -10, 5, 0, 5, 0, 0, 10, 0, 0, 10, 5, 0],
        3,
      ),
    ),
    mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  assert.equal(pointOnPart(mesh, [0, 2], -1, 1), false);
  const point = partAnchor(mesh, -1, 1);
  assert.ok(point);
  assert.equal(pointOnPart(mesh, point, -1, 1), true);
});
