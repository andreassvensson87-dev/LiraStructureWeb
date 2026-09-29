import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IfcAPI } from 'web-ifc';
import * as THREE from 'three';
import { ifcPlacement } from '../src/references/ifc-coordinates.js';
import { edgeIndex, referenceCandidates } from '../src/references/edge-index.js';
import { resolveSnap } from '../src/snap.js';
test('local IFC import preserves millimetres, placement, and Z-up; edges omit face diagonals', async () => {
  const api = new IfcAPI();
  await api.Init();
  const model = api.OpenModel(
    readFileSync(new URL('./fixtures/reference-box.ifc', import.meta.url)),
    { COORDINATE_TO_ORIGIN: false },
  );
  let meshes = 0;
  try {
    api.StreamAllMeshes(model, (mesh) => {
      const p = mesh.geometries.get(0),
        raw = api.GetGeometry(model, p.geometryExpressID);
      const v = api.GetVertexArray(raw.GetVertexData(), raw.GetVertexDataSize()),
        positions = [];
      for (let i = 0; i < v.length; i += 6) positions.push(v[i], v[i + 1], v[i + 2]);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(Array.from(api.GetIndexArray(raw.GetIndexData(), raw.GetIndexDataSize())));
      geometry.applyMatrix4(ifcPlacement(p.flatTransformation));
      geometry.computeBoundingBox();
      assert.deepEqual(geometry.boundingBox.min.toArray().map(Math.round), [900, 1800, 3000]);
      assert.deepEqual(geometry.boundingBox.max.toArray().map(Math.round), [1100, 2200, 3600]);
      const edges = new THREE.EdgesGeometry(geometry, 20);
      assert.equal(edges.attributes.position.count, 24);
      geometry.dispose();
      edges.dispose();
      raw.delete();
      meshes++;
    });
    assert.equal(meshes, 1);
  } finally {
    api.CloseModel(model);
  }
});
test('reference edge search finds exact corner and nearest edge; axis locks still apply', () => {
  const camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 1, 1000);
  camera.position.set(0, 0, 200);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const edges = new Float32Array([-50, 0, 0, 50, 0, 0]);
  const mesh = new THREE.Mesh();
  mesh.updateMatrixWorld();
  const parts = [{ mesh, edges, index: edgeIndex(edges) }];
  const ray = new THREE.Ray(new THREE.Vector3(0, 2, 200), new THREE.Vector3(0, 0, -1));
  const candidates = referenceCandidates(parts, {
    ray,
    camera,
    pointer: [100, 98],
    width: 200,
    height: 200,
  });
  assert.ok(candidates.some((c) => c.edge && Math.abs(c.coords[0]) < 1e-6 && c.coords[1] === 0));
  const snap = resolveSnap({
    referencePoints: candidates,
    ray,
    camera,
    pointer: [100, 98],
    width: 200,
    height: 200,
    sweeps: [],
    grid: { x: [], y: [] },
    z: 0,
    axisSnap: false,
  });
  assert.equal(snap.label, 'IFC-kant');
  const constrained = resolveSnap({
    referencePoints: [{ coords: [10, 10, 0], label: 'IFC-hörn' }],
    ray,
    camera,
    pointer: [110, 90],
    width: 200,
    height: 200,
    sweeps: [],
    grid: { x: [], y: [] },
    z: 0,
    start: [0, 0, 0],
    lock: 'X',
  });
  assert.notEqual(constrained.label, 'IFC-hörn');
});
