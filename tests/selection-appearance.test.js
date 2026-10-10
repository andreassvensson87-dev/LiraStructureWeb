import test from 'node:test';
import assert from 'node:assert/strict';
import { createObjectMesh, updateObjectMeshSelection } from '../src/model/object-mesh.js';

const beam = {
  id: 'beam',
  type: 'sweep',
  profile: 'rect',
  width: 100,
  height: 100,
  thickness: 0,
  rotation: 0,
  start: [0, 0, 0],
  end: [1000, 0, 0],
  colorOverride: '#bb925e',
};
test('marking and clearing preserve geometry, edges and transparent appearance', () => {
  for (const transparentView of [false, true]) {
    const mesh = createObjectMesh(beam, { model: [beam], selectedIds: new Set(), transparentView });
    const geometry = mesh.geometry,
      edges = mesh.children[0].geometry,
      material = mesh.material,
      edgeColor = mesh.children[0].material.color.getHex();
    updateObjectMeshSelection(mesh, beam, new Set(['beam']));
    assert.notEqual(mesh.material.color.getHexString(), beam.colorOverride.slice(1));
    assert.equal(mesh.material.opacity, transparentView ? 0.3 : 1);
    updateObjectMeshSelection(mesh, beam, new Set());
    assert.equal(mesh.material.color.getHexString(), 'bb925e');
    assert.equal(mesh.children[0].material.color.getHex(), edgeColor);
    assert.equal(mesh.geometry, geometry);
    assert.equal(mesh.children[0].geometry, edges);
    assert.equal(mesh.material, material);
    mesh.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
  }
});
test('cut selection preserves its shape and toggles visibility; helpers keep their own colours', () => {
  const cut = {
    id: 'cut',
    type: 'polygoncut',
    frame: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0] },
    polygon: [
      [0, 0],
      [20, 0],
      [20, 20],
      [0, 20],
    ],
    thickness: 100,
    side: 'positive',
    targets: ['beam'],
  };
  const mesh = createObjectMesh(cut, { model: [beam, cut], selectedIds: new Set() });
  const geometry = mesh.geometry;
  updateObjectMeshSelection(mesh, cut, new Set(['cut']));
  assert.equal(mesh.material.opacity, 0.2);
  assert.equal(mesh.children[0].material.opacity, 1);
  updateObjectMeshSelection(mesh, cut, new Set());
  assert.equal(mesh.material.opacity, 0);
  assert.equal(mesh.geometry, geometry);
  mesh.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
  const helper = { id: 'helper', type: 'helperline', start: [0, 0, 0], end: [100, 0, 0] };
  const line = createObjectMesh(helper, { selectedIds: new Set() });
  const helperColor = line.material.color.getHex();
  updateObjectMeshSelection(line, helper, new Set(['helper']));
  assert.notEqual(line.material.color.getHex(), helperColor);
  updateObjectMeshSelection(line, helper, new Set());
  assert.equal(line.material.color.getHex(), helperColor);
  line.geometry.dispose();
  line.material.dispose();
});
