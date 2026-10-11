import { createPartViews } from '../src/part-view-layout.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { arrangePartViews } from '../src/part-view-layout.js';
import { PartSections } from '../src/part-sections.js';
import { ensurePartViews } from '../src/drawing-views.js';

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

test('a new sheet has independent standard views and a source-up section without migration', () => {
  const bounds = new THREE.Box3(new THREE.Vector3(0, -50, -50), new THREE.Vector3(6000, 50, 50));
  const record = { type: 'SP', sourceId: 'beam', drawingPreset: { hiddenLines: false } };
  record.sheet = { views: createPartViews(record, bounds, 10) };
  const before = structuredClone(record.sheet.views);
  ensurePartViews(record);
  assert.deepEqual(record.sheet.views, before);
  assert.deepEqual(
    record.sheet.views.map((v) => v.id),
    ['top', 'front', 'section'],
  );
  for (const view of record.sheet.views) {
    assert.ok(view.size.every((n) => Number.isFinite(n) && n > 0));
    assert.ok(view.camera.center.every(Number.isFinite));
    assert.equal(view.settings.hiddenLines, false);
    assert.equal(view.source.objectId, 'beam');
  }
  assert.equal(record.sheet.views[2].source.parentViewId, 'front');
  assert.equal(record.sheet.views[2].section.points[0][0], 3000);
  record.sheet.views.splice(0, 1);
  ensurePartViews(record);
  assert.deepEqual(
    record.sheet.views.map((v) => v.id),
    ['front', 'section'],
  );
});
