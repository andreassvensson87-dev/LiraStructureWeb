import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { rotateSweep, parseAngle, rotationAxes } from '../src/rotation.js';
import { sweepCorners } from '../src/sweep.js';
const source = {
  id: 'a',
  profile: 'i',
  width: 200,
  height: 300,
  thickness: 12,
  rotation: 27,
  placement: { horizontalAlignment: 'right', verticalAlignment: 'top' },
  start: [100, 200, 300],
  end: [2100, 700, 1800],
};
test('rotation is a rigid transformation of every profile corner on all axes', () => {
  for (const axis of ['X', 'Y', 'Z'])
    for (const degrees of [90, -45, 180, 360]) {
      const pivot = [450, -700, 120],
        q = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(...rotationAxes[axis]),
          (degrees * Math.PI) / 180,
        ),
        p = new THREE.Vector3(...pivot);
      const expected = sweepCorners(source).map((c) =>
        new THREE.Vector3(...c).sub(p).applyQuaternion(q).add(p),
      );
      const actual = sweepCorners(rotateSweep(source, pivot, axis, degrees));
      actual.forEach((c, i) => assert.ok(new THREE.Vector3(...c).distanceTo(expected[i]) < 1e-7));
    }
});
test('rotation to and from vertical preserves eccentric profile orientation', () => {
  const horizontal = { ...source, start: [0, 0, 0], end: [3000, 0, 0] };
  const vertical = rotateSweep(horizontal, [0, 0, 0], 'Y', 90);
  assert.ok(Math.abs(vertical.end[2] + 3000) < 1e-8);
  const back = rotateSweep(vertical, [0, 0, 0], 'Y', -90);
  sweepCorners(back).forEach((p, i) =>
    assert.ok(
      new THREE.Vector3(...p).distanceTo(new THREE.Vector3(...sweepCorners(horizontal)[i])) < 1e-7,
    ),
  );
});
test('group rotation preserves distance and source records', () => {
  const copy = structuredClone(source),
    second = { ...source, start: [4100, 200, 300], end: [6100, 700, 1800] };
  const a = rotateSweep(source, [0, 0, 0], 'Z', 90),
    b = rotateSweep(second, [0, 0, 0], 'Z', 90);
  assert.ok(
    Math.abs(new THREE.Vector3(...a.start).distanceTo(new THREE.Vector3(...b.start)) - 4000) < 1e-7,
  );
  assert.deepEqual(source, copy);
});
test('angle input accepts signed decimal degrees and rejects incomplete or nonfinite input', () => {
  assert.equal(parseAngle('-45,5'), -45.5);
  assert.equal(parseAngle('+90'), 90);
  for (const text of ['', '-', 'Infinity', '1e9', 'NaN', '36001'])
    assert.throws(() => parseAngle(text));
});
test('arbitrary reference axis keeps points on the line fixed and rotates every corner rigidly', () => {
  const pivot = [100, 200, 300],
    axis = [2, 3, 4],
    q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis).normalize(), 0.7);
  const actual = rotateSweep(source, pivot, axis, THREE.MathUtils.radToDeg(0.7));
  sweepCorners(actual).forEach((p, i) => {
    const expected = new THREE.Vector3(...sweepCorners(source)[i])
      .sub(new THREE.Vector3(...pivot))
      .applyQuaternion(q)
      .add(new THREE.Vector3(...pivot));
    assert.ok(expected.distanceTo(new THREE.Vector3(...p)) < 1e-7);
  });
  assert.deepEqual(actual.start, pivot);
  assert.throws(() => rotateSweep(source, pivot, [0, 0, 0], 90));
});

test('rotating a workplane-oriented sweep preserves every corner and its reference normal', () => {
  const s = { ...source, profileUp: [0, -Math.SQRT1_2, Math.SQRT1_2] },
    pivot = [120, 330, -400],
    axis = new THREE.Vector3(1, 2, 3).normalize(),
    q = new THREE.Quaternion().setFromAxisAngle(axis, 0.7),
    p = new THREE.Vector3(...pivot);
  const result = rotateSweep(s, pivot, axis.toArray(), THREE.MathUtils.radToDeg(0.7));
  const expected = sweepCorners(s).map((c) =>
    new THREE.Vector3(...c).sub(p).applyQuaternion(q).add(p),
  );
  sweepCorners(result).forEach((c, i) =>
    assert.ok(new THREE.Vector3(...c).distanceTo(expected[i]) < 1e-7),
  );
  assert.ok(
    new THREE.Vector3(...result.profileUp).distanceTo(
      new THREE.Vector3(...s.profileUp).applyQuaternion(q),
    ) < 1e-10,
  );
});
