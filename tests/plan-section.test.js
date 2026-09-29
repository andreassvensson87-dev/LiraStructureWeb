import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { sectionSegments, planHeights } from '../src/plan-section.js';
test('height interval is relative to level and rejects invalid clipping range', () => {
  assert.deepEqual(planHeights(3500, -100, 1200, 3000), { lower: 3400, cut: 4700, upper: 6500 });
  assert.throws(() => planHeights(0, 100, 0, 200));
  assert.throws(() => planHeights(0, 0, NaN, 300));
});
test('section of box stays on boundary with no face triangulation diagonal', () => {
  const g = new THREE.BoxGeometry(200, 300, 400);
  for (const z of [0, 200, -200]) {
    const lines = sectionSegments(g, z);
    assert.ok(lines.length >= 4);
    for (const [a, b] of lines)
      assert.ok(
        (Math.abs(a[0]) === 100 && Math.abs(b[0]) === 100 && a[0] === b[0]) ||
          (Math.abs(a[1]) === 150 && Math.abs(b[1]) === 150 && a[1] === b[1]),
      );
  }
  assert.deepEqual(sectionSegments(g, 300), []);
  g.dispose();
});
test('section handles non-indexed geometry', () => {
  const g = new THREE.BoxGeometry(200, 300, 400),
    flat = g.toNonIndexed();
  assert.deepEqual(sectionSegments(g, 0), sectionSegments(flat, 0));
  g.dispose();
  flat.dispose();
});
