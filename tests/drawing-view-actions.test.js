import { installDrawingViewDeselection } from '../src/drawing-view-actions.js';
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
  assert.deepEqual(record.sheet.views, [
    { id: 'top', name: 'Top', settings: { profileDetail: 'exact' } },
  ]);
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

test('empty paper deselects a view and Escape cancels tools before clearing selection', async () => {
  const listeners = {},
    surfaceListeners = {};
  let selected = true,
    busy = false,
    cancelled = 0;
  installDrawingViewDeselection({
    dialog: {
      addEventListener: (type, callback) => {
        listeners[type] = callback;
      },
    },
    surface: {
      addEventListener: (type, callback) => {
        surfaceListeners[type] = callback;
      },
    },
    hit: (event) => event.view,
    selected: () => selected,
    busy: () => busy,
    clear: () => {
      selected = false;
    },
    cancel: () => {
      busy = false;
      cancelled++;
    },
  });
  await Promise.resolve();
  const event = (extra = {}) => ({
    button: 0,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {},
    ...extra,
  });
  surfaceListeners.pointerdown(event({ view: 'front' }));
  assert.equal(selected, true, 'a view hit keeps the selection');
  busy = true;
  surfaceListeners.pointerdown(event());
  assert.equal(selected, true, 'point placement does not deselect');
  listeners.keydown(event({ key: 'Escape' }));
  assert.equal(cancelled, 1);
  assert.equal(selected, true, 'first Escape cancels the tool');
  listeners.keydown(event({ key: 'Escape', defaultPrevented: true }));
  assert.equal(selected, true, 'menus and annotations retain priority');
  const escape = event({ key: 'Escape' });
  listeners.keydown(escape);
  assert.equal(selected, false);
  assert.equal(escape.defaultPrevented, true, 'deselection keeps the editor open');
  selected = true;
  surfaceListeners.pointerdown(event());
  assert.equal(selected, false, 'empty paper clears selection');
});
