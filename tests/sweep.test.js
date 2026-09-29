import * as THREE from 'three';
import { sweepFrame, profileAnchor } from '../src/sweep.js';
import { sweepCorners } from '../src/sweep.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { sweepGeometry, validateSweep } from '../src/sweep.js';
const base = {
  profile: 'rect',
  width: 200,
  height: 300,
  thickness: 12,
  rotation: 0,
  start: [0, 0, 0],
  end: [3000, 0, 0],
};
function volume(g) {
  const p = g.attributes.position;
  let sum = 0;
  for (let i = 0; i < p.count; i += 3) {
    const a = [p.getX(i), p.getY(i), p.getZ(i)],
      b = [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)],
      c = [p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)];
    sum +=
      (a[0] * (b[1] * c[2] - b[2] * c[1]) +
        a[1] * (b[2] * c[0] - b[0] * c[2]) +
        a[2] * (b[0] * c[1] - b[1] * c[0])) /
      6;
  }
  return sum;
}
test('all profiles are closed outward-facing solids of correct volume', () => {
  for (const [profile, area] of [
    ['rect', 60000],
    ['rhs', 60000 - 176 * 276],
    ['i', 2 * 200 * 12 + 276 * 12],
  ]) {
    const g = sweepGeometry({ ...base, profile });
    assert.ok(Math.abs(volume(g) - area * 3000) < 1);
    g.dispose();
  }
});
test('vertical sweep and rotation preserve length and dimensions', () => {
  const g = sweepGeometry({ ...base, start: [10, 20, 30], end: [10, 20, 3030], rotation: 90 });
  g.computeBoundingBox();
  assert.ok(Math.abs(g.boundingBox.max.x - g.boundingBox.min.x - 300) < 0.001);
  assert.equal(g.boundingBox.min.z, 30);
  assert.equal(g.boundingBox.max.z, 3030);
  g.dispose();
});
test('reject zero length, nonfinite coordinates and collapsed hollow profile', () => {
  assert.ok(validateSweep({ ...base, end: [0, 0, 0] }));
  assert.ok(validateSweep({ ...base, start: [NaN, 0, 0] }));
  assert.ok(validateSweep({ ...base, profile: 'rhs', thickness: 100 }));
  assert.equal(validateSweep(base), '');
});

test('corners match rendered vertices for inclined and vertical rotated profiles', () => {
  for (const [profile, count] of [
    ['rect', 8],
    ['rhs', 16],
    ['i', 24],
  ])
    for (const end of [
      [2100, 4300, 5900],
      [100, 200, 5300],
    ]) {
      const s = { ...base, profile, start: [100, 200, 300], end, rotation: 37 };
      const corners = sweepCorners(s),
        g = sweepGeometry(s),
        p = g.attributes.position;
      assert.equal(corners.length, count);
      assert.equal(new Set(corners.map((p) => p.join(','))).size, count);
      for (const corner of corners) {
        let closest = Infinity;
        for (let i = 0; i < p.count; i++)
          closest = Math.min(
            closest,
            Math.hypot(corner[0] - p.getX(i), corner[1] - p.getY(i), corner[2] - p.getZ(i)),
          );
        assert.ok(closest < 0.002);
      }
      g.dispose();
    }
});

test('all nine placements keep insertion axis fixed and transform corners with rotation', () => {
  for (const profile of ['rect', 'rhs', 'i'])
    for (const horizontalAlignment of ['left', 'center', 'right'])
      for (const verticalAlignment of ['top', 'center', 'bottom']) {
        const s = {
          ...base,
          profile,
          start: [100, 200, 300],
          end: [2100, 4300, 5900],
          rotation: 37,
          placement: { horizontalAlignment, verticalAlignment },
        };
        const { start, x, y } = sweepFrame(s),
          [ax, ay] = profileAnchor(s),
          points = sweepCorners(s).slice(0, profile === 'rect' ? 4 : profile === 'rhs' ? 8 : 12);
        const local = points.map((p) => new THREE.Vector3(...p).sub(start));
        assert.ok(Math.abs(Math.min(...local.map((p) => p.dot(x))) - (-s.width / 2 - ax)) < 1e-7);
        assert.ok(Math.abs(Math.max(...local.map((p) => p.dot(y))) - (s.height / 2 - ay)) < 1e-7);
        const g = sweepGeometry(s),
          v = g.attributes.position;
        for (const point of points) {
          let distance = Infinity;
          for (let i = 0; i < v.count; i++)
            distance = Math.min(
              distance,
              Math.hypot(point[0] - v.getX(i), point[1] - v.getY(i), point[2] - v.getZ(i)),
            );
          assert.ok(distance < 0.002);
        }
        g.dispose();
      }
});

test('quick circles, tubes and triangles have correct volume and cardinal snaps', () => {
  for (const [profile, area, count] of [
    ['circle', Math.PI * 100 ** 2, 8],
    ['chs', Math.PI * (100 ** 2 - 88 ** 2), 16],
    ['triangle', (200 * 300) / 2, 6],
  ]) {
    const s = { ...base, profile, height: profile === 'triangle' ? 300 : 200 },
      g = sweepGeometry(s);
    assert.equal(validateSweep(s), '');
    assert.ok(Math.abs(volume(g) / (area * 3000) - 1) < 0.001);
    assert.equal(sweepCorners(s).length, count);
    if (profile !== 'triangle') {
      const { start, x, y } = sweepFrame(s);
      for (const p of sweepCorners(s).slice(0, count / 2)) {
        const v = new THREE.Vector3(...p).sub(start);
        assert.ok(Math.min(Math.abs(v.dot(x)), Math.abs(v.dot(y))) < 1e-8);
      }
    }
    g.dispose();
  }
  assert.ok(validateSweep({ ...base, profile: 'chs', thickness: 100 }));
  assert.equal(validateSweep({ ...base, profile: 'triangle', thickness: 1000 }), '');
});
test('diameter changes normalize both transverse dimensions', async () => {
  const { normalizeForm } = await import('../src/profile-forms.js');
  for (const profile of ['circle', 'chs']) {
    const s = normalizeForm({ ...base, profile, width: 450 });
    assert.equal(s.height, 450);
    const g = sweepGeometry(s);
    g.computeBoundingBox();
    assert.equal(g.boundingBox.max.z - g.boundingBox.min.z, 450);
    g.dispose();
  }
  assert.equal(normalizeForm({ ...base, profile: 'triangle' }).height, 300);
});

test('workplane normal orients profile height and placement, with local profile rotation', () => {
  const normal = new THREE.Vector3(0, -1, 1).normalize(),
    s = {
      ...base,
      profileUp: normal.toArray(),
      placement: { horizontalAlignment: 'center', verticalAlignment: 'bottom' },
    };
  const frame = sweepFrame(s);
  assert.ok(frame.y.distanceTo(normal) < 1e-10);
  for (const corner of sweepCorners(s)) {
    const height = new THREE.Vector3(...corner).dot(normal);
    assert.ok(Math.abs(height) < 1e-8 || Math.abs(height - s.height) < 1e-8);
  }
  const turned = sweepFrame({ ...s, rotation: 90 });
  assert.ok(Math.abs(turned.x.dot(normal) + 1) < 1e-10);
  const vertical = sweepFrame({ ...s, end: [0, 0, 3000], profileUp: [0, 1, 0] });
  assert.ok(vertical.y.distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-10);
});
