import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createGeometryContext } from '../src/model-object.js';
const { objectGeometry, objectCorners, setModel: setGeometryModel } = createGeometryContext();
import { planeFrame } from '../src/plate.js';
const sweep = {
  id: 'beam',
  profile: 'rect',
  width: 200,
  height: 300,
  thickness: 12,
  rotation: 0,
  start: [0, 0, 0],
  end: [3000, 0, 0],
};
const cut = {
  id: 'cut',
  type: 'polygoncut',
  targets: ['beam'],
  frame: planeFrame('XY', [[1000, -500, 0]]),
  polygon: [
    [0, 0],
    [1000, 0],
    [1000, 1000],
    [0, 1000],
  ],
  thickness: 1000,
  side: 'center',
};
function volume(s) {
  const g = objectGeometry(s),
    p = g.attributes.position;
  let v = 0;
  for (let i = 0; i < p.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, i),
      b = new THREE.Vector3().fromBufferAttribute(p, i + 1),
      c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
    v += a.dot(b.cross(c)) / 6;
  }
  g.dispose();
  return v;
}
test('cut subtracts volume from targets, preserves originals and restores on removal', () => {
  const before = structuredClone(sweep);
  setGeometryModel([sweep, cut]);
  assert.ok(Math.abs(volume(sweep) - 120e6) < 10);
  assert.deepEqual(sweep, before);
  const corners = objectCorners(sweep);
  assert.ok(corners.some((p) => Math.abs(p[0] - 1000) < 0.01));
  assert.ok(corners.some((p) => Math.abs(p[0] - 2000) < 0.01));
  setGeometryModel([sweep]);
  assert.ok(Math.abs(volume(sweep) - 180e6) < 10);
});
test('changing depth, moving cut, and applying to Plate recomputes same target', () => {
  const plate = {
    id: 'plate',
    type: 'plate',
    frame: planeFrame('XY', [[0, 0, 0]]),
    polygon: [
      [0, 0],
      [3000, 0],
      [3000, 3000],
      [0, 3000],
    ],
    thickness: 200,
    side: 'center',
  };
  const c = { ...cut, targets: ['beam', 'plate'], frame: planeFrame('XY', [[1000, 0, 0]]) };
  setGeometryModel([sweep, plate, c]);
  assert.ok(Math.abs(volume(plate) - 1600e6) < 100);
  setGeometryModel([sweep, plate, { ...c, thickness: 100 }]);
  assert.ok(Math.abs(volume(plate) - 1700e6) < 100);
  setGeometryModel([sweep, plate, { ...c, frame: planeFrame('XY', [[10000, 0, 0]]) }]);
  assert.ok(Math.abs(volume(plate) - 1800e6) < 100);
});
test('complete removal, tangency and hollow profiles remain finite', () => {
  for (const profile of ['rect', 'rhs', 'i']) {
    const s = { ...sweep, profile };
    setGeometryModel([
      s,
      {
        ...cut,
        frame: planeFrame('XY', [[-1000, -1000, 0]]),
        polygon: [
          [0, 0],
          [5000, 0],
          [5000, 2000],
          [0, 2000],
        ],
      },
    ]);
    assert.ok(Math.abs(volume(s)) < 100);
    assert.deepEqual(objectCorners(s), []);
    setGeometryModel([s, { ...cut, frame: planeFrame('XY', [[3000, -500, 0]]) }]);
    assert.ok(Number.isFinite(volume(s)));
  }
});
test('new cut corners participate in snap and removed material is not window-selected', async () => {
  const { resolveSnap } = await import('../src/snap.js');
  const { enclosedSweeps } = await import('../src/selection.js');
  setGeometryModel([sweep, cut]);
  const camera = new THREE.OrthographicCamera(-500, 3500, 1500, -1500, 1, 10000);
  camera.position.set(0, 0, 5000);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const point = new THREE.Vector3(1000, 100, 150),
    projected = point.clone().project(camera),
    pointer = [(projected.x + 1) * 500, (1 - projected.y) * 400];
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(projected.x, projected.y), camera);
  const snap = resolveSnap({
    pointer,
    camera,
    width: 1000,
    height: 800,
    ray: ray.ray,
    start: null,
    z: 0,
    sweeps: [sweep],
    model: [sweep, cut],
    grid: { x: [], y: [] },
  });
  assert.equal(snap.label, 'Hörn');
  assert.ok(Math.abs(snap.point[0] - 1000) < 0.01);
  const p = new THREE.Vector3(1500, 0, 0).project(camera),
    x = (p.x + 1) * 500,
    y = (1 - p.y) * 400;
  assert.deepEqual(
    enclosedSweeps([sweep], camera, 1000, 800, { x: x + 20, y: y + 20 }, { x: x - 20, y: y - 20 }, [
      sweep,
      cut,
    ]),
    [],
  );
});
