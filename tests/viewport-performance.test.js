import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FrameGate } from '../src/model/frame-gate.js';
import { updateFastenerDetail } from '../src/model/fastener-detail.js';

test('resting views skip frames while edits, camera movement and projection changes repaint', () => {
  const camera = new THREE.OrthographicCamera(-500, 500, 500, -500, 1, 10000);
  camera.position.z = 1000;
  camera.updateMatrixWorld();
  const gate = new FrameGate();
  assert.equal(gate.consume(camera), true);
  assert.equal(gate.consume(camera), false);
  gate.invalidate();
  assert.equal(gate.consume(camera), true);
  assert.equal(gate.consume(camera), false);
  camera.position.x = 20;
  camera.updateMatrixWorld();
  assert.equal(gate.consume(camera), true);
  camera.zoom = 2;
  camera.updateProjectionMatrix();
  assert.equal(gate.consume(camera), true);
  assert.equal(gate.consume(camera), false);
});

test('small hardware is omitted from overview drawing and picking, then returns on zoom or individual selection', () => {
  const camera = new THREE.OrthographicCamera(-50000, 50000, 50000, -50000, 1, 1000000);
  const hardware = new THREE.Mesh(
    new THREE.BoxGeometry(20, 20, 100),
    new THREE.MeshBasicMaterial(),
  );
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(hardware.geometry),
    new THREE.LineBasicMaterial(),
  );
  hardware.add(outline);
  hardware.userData = { id: 'bolt', detailDiameter: 40 };
  const structure = new THREE.Object3D();
  const geometry = hardware.geometry;
  updateFastenerDetail([hardware, structure], camera, 600, new Set());
  assert.equal(camera.layers.test(hardware.layers), false);
  assert.equal(camera.layers.test(outline.layers), false);
  assert.equal(camera.layers.test(structure.layers), true);
  assert.equal(hardware.visible, true);
  assert.equal(hardware.geometry, geometry);
  updateFastenerDetail([hardware], camera, 600, new Set(['bolt']));
  assert.equal(camera.layers.test(hardware.layers), true);
  updateFastenerDetail([hardware], camera, 600, new Set(['bolt', 'a', 'b', 'c', 'd']));
  assert.equal(camera.layers.test(hardware.layers), false);
  camera.zoom = 10;
  updateFastenerDetail([hardware], camera, 600, new Set());
  assert.equal(camera.layers.test(hardware.layers), true);
  assert.equal(camera.layers.test(outline.layers), true);
  hardware.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
});
