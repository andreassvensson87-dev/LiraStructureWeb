import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { migrateIndependentPartViews, arrangePartViews } from '../src/part-view-migration.js';
import { PartSections } from '../src/part-sections.js';
import { ensurePartViews } from '../src/drawing-views.js';

test('legacy views preserve model-to-paper mapping, ids and scales independently', () => {
  const bounds = new THREE.Box3(
    new THREE.Vector3(-80, -200, 40),
    new THREE.Vector3(2920, 100, 440),
  );
  const sheet = {
    layout: { x: 25, topY: 40, y: 100 },
    views: [
      { id: 'top', scale: 20, camera: { center: [0, 0] } },
      { id: 'front', scale: 10, camera: { center: [0, 0] } },
    ],
  };
  const points = [
    [-80, 0],
    [300, 70],
    [2000, 130],
  ];
  migrateIndependentPartViews(sheet, bounds);
  const renderer = Object.create(PartSections.prototype);
  for (const view of sheet.views) {
    const cy = view.id === 'top' ? -50 : 240;
    const y = view.id === 'top' ? 40 : 100;
    for (const point of points) {
      const actual = renderer.project(point, view);
      const expected = [25 + (point[0] + 80) / view.scale, y - (point[1] - cy) / view.scale];
      actual.forEach((n, i) => assert.ok(Math.abs(n - expected[i]) < 1e-9));
    }
  }
  const before = structuredClone(sheet.views[1]);
  sheet.views[0].position[0] += 50;
  assert.deepEqual(sheet.views[1], before);
  const copy = structuredClone(sheet);
  migrateIndependentPartViews(sheet, bounds);
  assert.deepEqual(sheet, copy);
  ensurePartViews({ sheet, sourceId: 'beam' });
  assert.equal(sheet.views.find((v) => v.id === 'top').standard, true);
  assert.deepEqual(sheet.views.find((v) => v.id === 'front').position, before.position);
});
test('arrange operates on all views without modifying their scale or camera', () => {
  const views = [0, 1, 2].map((i) => ({
    id: String(i),
    position: [99, 99],
    size: [100, 50],
    scale: 10 + i,
    camera: { center: [i, 0] },
  }));
  arrangePartViews(views, 240);
  assert.deepEqual(
    views.map((v) => v.position),
    [
      [10, 10],
      [120, 10],
      [10, 72],
    ],
  );
  assert.deepEqual(
    views.map((v) => v.scale),
    [10, 11, 12],
  );
  assert.deepEqual(views[2].camera.center, [2, 0]);
});
