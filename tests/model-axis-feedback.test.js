import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { modelAxisFeedback } from '../src/model/axis-feedback.js';
import { drawingWorkPlane } from '../src/work-plane.js';
const camera = new THREE.OrthographicCamera(-5000, 5000, 5000, -5000, 1, 100000);
camera.up.set(0, 0, 1);
camera.position.set(10000, -14000, 12000);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld();
const feedback = (options) =>
  modelAxisFeedback({ camera, width: 1000, height: 1000, start: [0, 0, 0], ...options });

test('creation, grips, move and copy share local axis feedback and a fixed-size origin corner', () => {
  const frame = { origin: [0, 0, 0], u: [Math.SQRT1_2, 0, Math.SQRT1_2], v: [0, 1, 0] };
  for (const mode of [null, 'polysweepCreate', 'grip', 'move', 'copy']) {
    const workPlane = drawingWorkPlane(mode ? { mode } : null, frame);
    assert.equal(workPlane, frame);
    const snap = { point: frame.u.map((v) => v * 2000), kind: 'direction' };
    const before = structuredClone(snap);
    const result = feedback({ snap, workPlane });
    assert.equal(result.axis, 'X');
    assert.ok(result.corner);
    assert.ok(Math.abs(Math.hypot(...result.corner[0].map((v, i) => v - result.a[i])) - 7) < 1e-7);
    assert.deepEqual(snap, before);
    const zoomed = camera.clone();
    zoomed.zoom = 2;
    zoomed.updateProjectionMatrix();
    const zoom = feedback({ camera: zoomed, snap, workPlane });
    assert.ok(Math.abs(Math.hypot(...zoom.end.map((v, i) => v - zoom.b[i])) - 28) < 1e-7);
    assert.ok(Math.abs(Math.hypot(...zoom.corner[0].map((v, i) => v - zoom.a[i])) - 7) < 1e-7);
  }
});
test('feedback distinguishes axes from oblique polar and hides for free, idle, zero or end-on results', () => {
  for (const [axis, point] of [
    ['X', [-2500, 0, 0]],
    ['Y', [0, 2500, 0]],
    ['Z', [0, 0, 2500]],
  ])
    assert.equal(feedback({ snap: { point, kind: 'point' } }).axis, axis);
  const top = camera.clone();
  top.position.set(0, 0, 10000);
  top.up.set(0, 1, 0);
  top.lookAt(0, 0, 0);
  top.updateMatrixWorld();
  assert.equal(feedback({ camera: top, snap: { point: [0, 0, 2500], kind: 'direction' } }), null);
  const polar = feedback({ snap: { point: [1500, 1500, 0], kind: 'direction' } });
  assert.equal(polar.axis, undefined);
  assert.equal(polar.corner, null);
  for (const options of [
    { start: null, snap: { point: [2500, 0, 0], kind: 'direction' } },
    { snap: null },
    { snap: { point: [2500, 0, 0], kind: 'free' } },
    { snap: { point: [0, 0, 0], kind: 'direction' } },
    { snap: { point: [1000, 700, 400], kind: 'point' } },
  ])
    assert.equal(feedback(options), null);
});
