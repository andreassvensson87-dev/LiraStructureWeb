import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureGAViews,
  duplicateDrawingView,
  cropDrawingView,
  syncPartViews,
} from '../src/drawing-views.js';
const view = {
  id: 'plan',
  name: 'Plan',
  kind: 'view',
  source: { type: 'model' },
  position: [10, 20],
  size: [100, 80],
  scale: 50,
  camera: { center: [3000, 4000] },
  settings: { levelId: 'l1', cut: 1200 },
};
const paperPoint = (v, p) => [
  v.position[0] + v.size[0] / 2 + (p[0] - v.camera.center[0]) / v.scale,
  v.position[1] + v.size[1] / 2 - (p[1] - v.camera.center[1]) / v.scale,
];
test('corner and edge crops retain scale and model placement on paper', () => {
  for (const corner of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
    const next = cropDrawingView(view, corner, [20, 10]);
    assert.equal(next.scale, 50);
    assert.deepEqual(paperPoint(next, [3500, 4500]), paperPoint(view, [3500, 4500]));
    assert.ok(next.size.every((n) => n >= 15));
  }
  const next = cropDrawingView(view, 'nw', [10000, 10000]);
  assert.deepEqual(next.size, [15, 15]);
  assert.deepEqual(view.position, [10, 20]);
});
test('legacy GA migration preserves camera, annotations, scale and placement, and is idempotent', () => {
  const record = {
    levelId: 'l1',
    settings: { cut: 1200 },
    sheet: { viewScale: 20, viewPosition: [-5, 30] },
    annotations: [{ id: 'note', view: 'plan' }],
  };
  const views = ensureGAViews(record, [420, 297], [100, 200], 50);
  assert.equal(views[0].scale, 20);
  assert.deepEqual(views[0].camera.center, [100, 200]);
  assert.deepEqual(views[0].position, [-5, 30]);
  assert.equal(ensureGAViews(record, [800, 600], [0, 0], 100), views);
  assert.equal(record.annotations.length, 1);
});
test('duplicates isolate settings and annotations, new views omit annotations', () => {
  const notes = [
    { id: 'a', view: 'plan', points: [[1, 2]] },
    { id: 'b', view: 'other' },
  ];
  const copy = duplicateDrawingView(view, [view], notes);
  assert.notEqual(copy.view.id, view.id);
  assert.equal(copy.annotations.length, 1);
  assert.equal(copy.annotations[0].view, copy.view.id);
  copy.annotations[0].points[0][0] = 9;
  copy.view.settings.cut = 42;
  assert.equal(notes[0].points[0][0], 1);
  assert.equal(view.settings.cut, 1200);
  assert.equal(
    duplicateDrawingView(view, [view], notes, { copyAnnotations: false }).annotations.length,
    0,
  );
});
test('Single Part uses the same paper rectangles and links its section to the parent view', () => {
  const record = { sourceId: 'beam', sheet: {} };
  const config = {
    scales: { top: 10, front: 5, section: 2 },
    hiddenLines: { top: true, front: true, section: true },
    section: 200,
  };
  syncPartViews(record, config, [
    [10, 10, 110, 30],
    [10, 50, 210, 90],
    [250, 50, 280, 90],
  ]);
  assert.equal(record.sheet.viewsVersion, 2);
  assert.deepEqual(record.sheet.views[1].size, [200, 40]);
  assert.deepEqual(record.sheet.views[1].position, [10, 50]);
  assert.equal(record.sheet.views[2].source.parentViewId, 'front');
  assert.equal(record.sheet.views[2].source.objectId, 'beam');
  assert.equal(record.sheet.views[2].settings.section, 200);
});
test('refreshing the three standard part views preserves custom linked sections', () => {
  const custom = {
    id: 'custom',
    kind: 'section',
    section: { label: 'B' },
    source: { parentViewId: 'front' },
  };
  const record = { sourceId: 'beam', sheet: { views: [custom] } },
    config = { scales: { top: 10, front: 10, section: 10 }, hiddenLines: {}, section: 0 };
  syncPartViews(record, config, [
    [0, 0, 10, 10],
    [0, 0, 10, 10],
    [0, 0, 10, 10],
  ]);
  assert.equal(record.sheet.views.length, 4);
  assert.equal(record.sheet.views[3], custom);
});

test('legacy Single Part scale maps migrate once and common records remain authoritative', async () => {
  const { ensurePartViews, partViewScales, setDrawingViewScale } = await import(
    '../src/drawing-views.js'
  );
  const record = {
    sourceId: 's',
    sheet: { scales: { top: 20, front: 10, section: 5 }, hiddenLines: { top: false }, section: 12 },
  };
  ensurePartViews(record);
  assert.equal(record.sheet.scales, undefined);
  assert.equal(record.sheet.hiddenLines, undefined);
  assert.equal(record.sheet.views[0].settings.hiddenLines, false);
  setDrawingViewScale(record.sheet.views[0], 25);
  ensurePartViews(record);
  assert.equal(partViewScales(record.sheet).top, 25);
  assert.throws(() => setDrawingViewScale(record.sheet.views[0], NaN));
  assert.equal(partViewScales(record.sheet).top, 25);
});
