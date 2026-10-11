import test from 'node:test';
import assert from 'node:assert/strict';
import { DrawingToolFeedback, polarPoint } from '../src/drawing-tool-feedback.js';
import { snapDrawingLines } from '../src/drawing-grid-snap.js';
test('polar constrains near a chosen direction, including negative directions', () => {
  assert.deepEqual(polarPoint([100, 3], [0, 0], 45, 5), [100, 0]);
  const p = polarPoint([-100, 3], [0, 0], 45, 5);
  assert.ok(Math.abs(p[0] + 100) < 1e-8 && Math.abs(p[1]) < 1e-8);
  assert.equal(polarPoint([100, 30], [0, 0], 45, 5), null);
  assert.equal(polarPoint([100, 3], [0, 0], 0, 5), null);
});
test('polar supports custom angles and leaves base unchanged', () => {
  const base = [10, 20],
    p = polarPoint([110, 77], base, 30, 5);
  assert.ok(Math.abs((p[1] - 20) / (p[0] - 10) - Math.tan(Math.PI / 6)) < 1e-9);
  assert.deepEqual(base, [10, 20]);
});
test('reference snap prefers crossing and respects segment extents', () => {
  const lines = [
    [
      [0, 0],
      [100, 0],
    ],
    [
      [50, -100],
      [50, 100],
    ],
  ];
  assert.deepEqual(snapDrawingLines([53, 2], lines, 5), [50, 0]);
  assert.deepEqual(snapDrawingLines([20, 3], lines, 5), [20, 0]);
  assert.equal(snapDrawingLines([120, 3], lines, 5), null);
  assert.equal(snapDrawingLines([20, 20], lines, 5), null);
});

test('section/detail pointer preview updates its view layer without rebuilding the scene', () => {
  const feedback = Object.create(DrawingToolFeedback.prototype);
  const calls = [];
  const root = { isConnected: true, replaceChildren: () => calls.push('clear preview') };
  const project = (point) => point;
  feedback.tool = {
    draft: { parentId: 'plan' },
    paint: (layer, view, projection, unit) => {
      assert.equal(layer, root);
      assert.equal(view, 'plan');
      assert.equal(projection, project);
      assert.equal(unit, 2);
      calls.push('preview');
    },
    adapter: { redraw: () => calls.push('scene') },
  };
  feedback.cursor = () => {};
  feedback.placing = () => false;
  feedback.locate = () => ({ point: [25, 50], view: 'plan' });
  feedback.graphics = new Map([['plan', { root, project, unit: 2 }]]);
  feedback.move({});
  assert.deepEqual(feedback.tool.hover, [25, 50]);
  assert.deepEqual(calls, ['clear preview', 'preview']);
  root.isConnected = false;
  feedback.move({});
  assert.equal(calls.at(-1), 'scene');
});
