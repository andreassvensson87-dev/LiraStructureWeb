import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { hiddenEdges } from '../src/drawing-hidden-lines.js';
test('hidden edges use occluded depth fragments and retain clipping limits', () => {
  const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(30, 40, 0),
    ]),
    plane = new THREE.Plane(new THREE.Vector3(0, 0, 1));
  const lines = hiddenEdges(g, { dashSize: 20, gapSize: 10, clippingPlanes: [plane] });
  assert.equal(lines.material.depthFunc, THREE.GreaterDepth);
  assert.equal(lines.material.depthWrite, false);
  assert.equal(lines.material.depthTest, true);
  assert.equal(lines.material.clippingPlanes[0], plane);
  assert.equal(g.attributes.lineDistance.getX(1), 50);
  lines.material.dispose();
  g.dispose();
});
