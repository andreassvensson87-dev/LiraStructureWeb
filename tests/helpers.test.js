import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { isPhysical, objectAnchors, objectSegments, validateObject } from '../src/model-object.js';
import { transformObject } from '../src/transform.js';
import { rotateObject } from '../src/rotation.js';
import { numberParts } from '../src/part-marks.js';
import { planDrawingNumbering } from '../src/single-part-drawings.js';
import { enclosedSweeps } from '../src/selection.js';
import { resolveSnap } from '../src/snap.js';
import { pointerCommand } from '../src/model/pointer-controller.js';
const point = { id: 'p', type: 'helperpoint', start: [0, 0, 0] };
const line = { id: 'l', type: 'helperline', start: [-100, 0, 0], end: [100, 0, 0] };
const camera = new THREE.OrthographicCamera(-200, 200, 200, -200, 1, 10000);
camera.position.set(0, 0, 1000);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld();
test('helpers validate coordinates and reject degenerate lines', () => {
  assert.equal(validateObject(point), '');
  assert.equal(validateObject(line), '');
  assert.ok(validateObject({ ...point, start: [NaN, 0, 0] }));
  assert.ok(validateObject({ ...line, end: line.start }));
  assert.deepEqual(objectSegments(point), []);
  assert.deepEqual(objectSegments(line), [[line.start, line.end]]);
});
test('helpers move, copy and rotate without mutating their reference points', () => {
  for (const s of [point, line]) {
    const original = structuredClone(s),
      moved = transformObject(s, 'copy', [0, 0, 0], [10, 20, 30]);
    assert.deepEqual(
      objectAnchors(moved),
      objectAnchors(s).map((p) => p.map((v, i) => v + [10, 20, 30][i])),
    );
    const rotated = rotateObject(s, [0, 0, 0], 'Z', 90);
    objectAnchors(rotated).forEach((p, i) => {
      const [x, y, z] = objectAnchors(s)[i];
      assert.ok(Math.hypot(p[0] + y, p[1] - x, p[2] - z) < 1e-6);
    });
    assert.deepEqual(s, original);
  }
});
test('helpers never receive manufacturing marks or drawing candidates', () => {
  assert.equal(isPhysical(line), false);
  assert.equal(isPhysical(point), false);
  const parts = numberParts([line, point]);
  assert.deepEqual(parts.assignments, {});
  assert.deepEqual(parts.registry, []);
  assert.doesNotThrow(() => planDrawingNumbering([line, point], parts, []));
});
test('window selection contains helpers while crossing selection intersects a line', () => {
  const objects = [line, point];
  assert.deepEqual(
    enclosedSweeps(objects, camera, 400, 400, { x: 190, y: 190 }, { x: 210, y: 210 }),
    ['p'],
  );
  assert.deepEqual(
    enclosedSweeps(objects, camera, 400, 400, { x: 210, y: 210 }, { x: 190, y: 190 }),
    ['l', 'p'],
  );
  assert.deepEqual(enclosedSweeps(objects, camera, 400, 400, { x: 0, y: 0 }, { x: 50, y: 50 }), []);
});
function snap(target, objects, extra = {}) {
  const p = new THREE.Vector3(...target).project(camera),
    raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(p.x, p.y), camera);
  return resolveSnap({
    pointer: [(p.x + 1) * 200, (1 - p.y) * 200],
    camera,
    width: 400,
    height: 400,
    ray: raycaster.ray,
    sweeps: objects,
    grid: { x: [], y: [] },
    z: 0,
    midpointSnap: true,
    perpendicularSnap: true,
    ...extra,
  });
}
test('helpers provide point, midpoint and perpendicular snap', () => {
  assert.deepEqual(snap(point.start, [point]).point, point.start);
  assert.match(snap([0, 0, 0], [line]).label, /Mittpunkt/);
  assert.match(
    snap([50, 0, 0], [line], { start: [50, 80, 0], midpointSnap: false }).label,
    /Vinkelrät/,
  );
  assert.equal(snap([0, 0, 0], []).kind, 'free');
});
test('helper point is a single click; helper line follows two-point drawing', () => {
  assert.equal(pointerCommand({ mode: 'helperpoint', drawing: true }), 'helperpoint');
  assert.equal(pointerCommand({ mode: 'helperline', drawing: true, hasStart: false }), 'start');
  assert.equal(pointerCommand({ mode: 'helperline', drawing: true, hasStart: true }), 'finish');
  assert.equal(
    pointerCommand({ mode: 'helperline', drawing: true, hasStart: true, hasLength: true }),
    'length',
  );
});
