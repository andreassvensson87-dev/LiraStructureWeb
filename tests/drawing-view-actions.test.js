import test from 'node:test';
import assert from 'node:assert/strict';
import { dependentViewIds, alignDrawingView } from '../src/drawing-view-actions.js';
import { ensurePartViews, duplicateDrawingView } from '../src/drawing-views.js';

test('deletion includes nested descendants but not sibling views', () => {
  const views = [
    { id: 'detail', source: { parentViewId: 'section' } },
    { id: 'section', source: { parentViewId: 'front' } },
    { id: 'front' },
    { id: 'top' },
  ];
  assert.deepEqual([...dependentViewIds(views, 'front')].sort(), ['detail', 'front', 'section']);
  assert.deepEqual([...dependentViewIds(views, 'section')].sort(), ['detail', 'section']);
});
test('alignment moves only one paper axis and leaves scale, crop and reference unchanged', () => {
  const view = { position: [10, 20], size: [40, 60], scale: 5, camera: { center: [50, 80] } };
  const target = { position: [100, 200], size: [80, 100] };
  const before = structuredClone(target);
  alignDrawingView(view, target, 'horizontal');
  assert.deepEqual(view.position, [10, 220]);
  alignDrawingView(view, target, 'vertical');
  assert.deepEqual(view.position, [120, 220]);
  assert.deepEqual(view.camera.center, [50, 80]);
  assert.equal(view.scale, 5);
  assert.deepEqual(target, before);
});
test('removed independent base views stay removed on reopen', () => {
  const record = { sheet: { independentViews: true, views: [{ id: 'top', name: 'Ovanifrån' }] } };
  ensurePartViews(record);
  ensurePartViews(record);
  assert.deepEqual(record.sheet.views, [{ id: 'top', name: 'Top' }]);
});
test('duplicate preserves section crop and copies annotations with independent ids', () => {
  const view = {
    id: 'section',
    name: 'A',
    position: [10, 20],
    size: [30, 40],
    camera: { center: [200, 300] },
    source: { parentViewId: 'front' },
    section: { depth: 100 },
  };
  const annotation = {
    id: 'dim',
    view: 'section',
    points: [
      [1, 2],
      [3, 4],
    ],
  };
  const copy = duplicateDrawingView(view, [view], [annotation]);
  assert.deepEqual(copy.view.camera, view.camera);
  assert.deepEqual(copy.view.size, view.size);
  assert.notEqual(copy.view.id, view.id);
  assert.equal(copy.annotations[0].view, copy.view.id);
  copy.annotations[0].points[0][0] = 99;
  assert.equal(annotation.points[0][0], 1);
});
