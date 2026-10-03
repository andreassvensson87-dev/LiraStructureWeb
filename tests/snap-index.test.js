import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SnapIndex } from '../src/model/snap-index.js';
import { resolveSnap } from '../src/snap.js';
import { createObjectMesh } from '../src/model/object-mesh.js';
import { selectionGeometryReader } from '../src/model-object.js';
import { createFrameExample } from '../src/project/frame-example.js';

const beam = (id, x) => ({
  id,
  type: 'sweep',
  profile: 'rect',
  width: 100,
  height: 100,
  thickness: 0,
  rotation: 0,
  start: [x, 0, 0],
  end: [x, 1000, 0],
});
const camera = new THREE.OrthographicCamera(-5000, 5000, 5000, -5000, 1, 100000);
camera.position.set(0, 0, 10000);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld();
const pointer = (point) => {
  const p = new THREE.Vector3(...point).project(camera);
  return [(p.x + 1) * 500, (1 - p.y) * 500];
};
const snap = (model, index, p, options = {}) =>
  resolveSnap({
    pointer: p,
    camera,
    width: 1000,
    height: 1000,
    ray: new THREE.Ray(new THREE.Vector3(0, 0, 10000), new THREE.Vector3(0, 0, -1)),
    start: null,
    z: 0,
    model,
    sweeps: index ? index.query(camera, 1000, 1000, p) : model,
    geometryContext: index?.context,
    grid: { x: [], y: [] },
    ...options,
  });

test('nearby bounds retain exact endpoint and midpoint snapping while skipping distant details', () => {
  const model = Array.from({ length: 2000 }, (_, i) => beam(`b${i}`, i * 1000));
  const index = new SnapIndex(model);
  let visited = 0;
  const corners = index.context.objectCorners;
  index.context.objectCorners = (s) => {
    visited++;
    return corners(s);
  };
  for (const target of [
    [0, 0, 0],
    [0, 500, 0],
  ]) {
    const p = pointer(target),
      options = { midpointSnap: true };
    assert.deepEqual(snap(model, index, p, options), snap(model, null, p, options));
  }
  assert.ok(visited < 20);
  camera.position.x = 1000;
  camera.lookAt(1000, 0, 0);
  camera.updateMatrixWorld();
  assert.ok(index.query(camera, 1000, 1000, pointer([1000, 0, 0])).some((s) => s.id === 'b1'));
});

test('snap bounds include displaced sweep insertion axes outside the material', () => {
  const s = {
    ...beam('offset', 0),
    placement: { horizontalAlignment: 'left', verticalAlignment: 'top' },
  };
  const index = new SnapIndex([s]);
  const p = pointer(s.start);
  assert.ok(index.query(camera, 1000, 1000, p).includes(s));
  assert.deepEqual(snap([s], index, p).point, s.start);
});

test('adding a sweep retains existing mesh geometry identities; changing a cut invalidates only its target', () => {
  const a = beam('a', 0),
    b = beam('b', 1000),
    model = [a, b];
  const meshes = model.map((s) => createObjectMesh(s, { model, selectedIds: new Set() }));
  const added = [...model, beam('new', 2000)],
    reader = selectionGeometryReader(added);
  for (let i = 0; i < meshes.length; i++)
    assert.equal(meshes[i].userData.geometryIdentity, reader(model[i]));
  const cut = {
    id: 'cut',
    type: 'polygoncut',
    targets: ['a'],
    frame: { origin: [-20, 100, 0], u: [1, 0, 0], v: [0, 1, 0] },
    polygon: [
      [0, 0],
      [40, 0],
      [40, 100],
      [0, 100],
    ],
    thickness: 100,
    side: 'positive',
  };
  const changed = selectionGeometryReader([...added, cut]);
  assert.notEqual(meshes[0].userData.geometryIdentity, changed(a));
  assert.equal(meshes[1].userData.geometryIdentity, changed(b));
  for (const mesh of meshes)
    mesh.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
});

test('nearby template features preserve drilled beam snapping after translation and rotation', () => {
  const model = createFrameExample('small', { prepareGeometry: true }).objects;
  const index = new SnapIndex(model);
  for (const axis of ['X', 'Y']) {
    const s = model.find((o) => o.profile === 'i' && o.name.includes(`${axis}-balk`));
    const corners = index.context.objectCorners(s);
    const segments = index.context.objectSegments(s);
    const targets = [corners[0], segments[0][0].map((n, i) => (n + segments[0][1][i]) / 2)];
    for (const target of targets) {
      const p = pointer(target);
      const options = { midpointSnap: true, perpendicularSnap: true, start: s.start };
      const filtered = index.nearbyContext(camera, 1000, 1000, p, s.start, true, true);
      assert.deepEqual(
        snap(model, index, p, { ...options, geometryContext: filtered }),
        snap(model, index, p, options),
      );
    }
  }
});
