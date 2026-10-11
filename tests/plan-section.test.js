import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { sectionSegments, planHeights } from '../src/plan-section.js';
import { buildPlanObjects, buildSectionObjects } from '../src/plan-view-geometry.js';
import { profileSnapshot } from '../src/section-profile.js';
import { TIBNOR_PROFILES } from '../src/tibnor-catalog.js';
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

test('drawing geometry builders preserve source snaps and hatch while clipping excluded parts', () => {
  const beam = {
    id: 'beam',
    type: 'sweep',
    name: 'Beam',
    profile: 'custom',
    section: profileSnapshot(TIBNOR_PROFILES[0]),
    width: 200,
    height: 190,
    thickness: 10,
    rotation: 0,
    start: [0, 0, 0],
    end: [1000, 0, 0],
    material: 'steel',
  };
  const excluded = { ...beam, id: 'excluded', start: [0, 0, 1000], end: [1000, 0, 1000] };
  const objects = [beam, excluded],
    original = JSON.stringify(objects);
  for (const section of [false, true]) {
    const output = {
      group: new THREE.Group(),
      bounds: new THREE.Box3(),
      annotationCandidates: [],
      sections: [],
      hatchSurfaces: [],
    };
    try {
      const args = { ...output, objects, detail: 'schematic', hiddenLines: true };
      if (section)
        buildSectionObjects({
          ...args,
          scale: 50,
          depth: 100,
          matrix: new THREE.Matrix4(),
          planes: [],
          frame: {},
        });
      else buildPlanObjects({ ...args, h: { lower: -100, cut: 0, upper: 100 }, planes: () => [] });
      assert.equal(output.group.children.filter((node) => node.isMesh).length, 1);
      assert.ok(output.group.children.some((node) => node.userData.sourceId === beam.id));
      assert.ok(output.annotationCandidates.length > 0);
      assert.ok(output.annotationCandidates.every((point) => point.reference.source === beam.id));
      assert.ok(output.sections.length > 0);
      assert.equal(output.hatchSurfaces[0].material, beam.material);
      assert.ok(!output.bounds.isEmpty());
      assert.equal(JSON.stringify(objects), original);
    } finally {
      output.group.traverse((node) => {
        node.geometry?.dispose();
        node.material?.dispose();
      });
    }
  }
});
