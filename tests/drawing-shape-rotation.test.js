import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rotatedShapes,
  rotationAngle,
  DrawingShapeTransform,
} from '../src/drawing-shape-transform.js';
import { DrawingAnnotations } from '../src/drawing-annotations.js';
import { arcGeometry } from '../src/drawing-shapes.js';
const shapes = () => [
  {
    id: 'rect',
    type: 'shape',
    shape: 'rectangle',
    view: 'top',
    points: [
      [10, 20],
      [30, 30],
    ],
  },
  {
    id: 'circle',
    type: 'shape',
    shape: 'circle',
    view: 'top',
    points: [
      [20, 25],
      [25, 25],
    ],
  },
  {
    id: 'arc',
    type: 'shape',
    shape: 'arc',
    view: 'top',
    points: [
      [10, 20],
      [20, 30],
      [30, 20],
    ],
  },
];
const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≈ ${expected}`);
test('rotation around an arbitrary center preserves circles and arcs and all four rectangle corners', () => {
  const items = shapes(),
    before = structuredClone(items);
  const result = rotatedShapes(
    items,
    items.map((i) => i.id),
    [10, 20],
    Math.PI / 4,
  );
  assert.deepEqual(items, before);
  assert.equal(result[0].id, 'rect');
  assert.equal(result[0].shape, 'polyline');
  assert.equal(result[0].closed, true);
  assert.equal(result[0].points.length, 4);
  assert.deepEqual(result[0].points[0], [10, 20]);
  near(Math.hypot(...result[0].points[1].map((v, i) => v - result[0].points[0][i])), 20);
  near(Math.hypot(...result[1].points[1].map((v, i) => v - result[1].points[0][i])), 5);
  near(arcGeometry(result[2].points).radius, arcGeometry(items[2].points).radius);
  near(arcGeometry(result[2].points).sweep, arcGeometry(items[2].points).sweep);
  const back = rotatedShapes(
    result,
    result.map((i) => i.id),
    [10, 20],
    -Math.PI / 4,
  );
  back[1].points.flat().forEach((v, i) => near(v, items[1].points.flat()[i]));
});
test('mouse rotation measures the signed angle between two rays, including angle wrap', () => {
  near(rotationAngle([10, 10], [20, 10], [10, 20]), Math.PI / 2);
  near(rotationAngle([0, 0], [-1, 0.01], [-1, -0.01]), 2 * Math.atan(0.01));
  assert.throws(() => rotationAngle([0, 0], [0, 0], [1, 0]));
  assert.throws(() => rotatedShapes(shapes(), ['rect'], [0, 0], 0));
  assert.throws(() => rotatedShapes(shapes(), ['rect'], [0, 0], NaN));
});
test('mouse rotation commits multiple shapes once and undo restores the original rectangle representation', () => {
  const editor = Object.create(DrawingAnnotations.prototype),
    transform = Object.create(DrawingShapeTransform.prototype);
  let point = [10, 20];
  Object.assign(editor, {
    items: shapes(),
    history: [],
    future: [],
    record: {},
    mode: 'rotate-shapes',
    location: () => ({ point, view: 'top' }),
    ui() {},
    cancel() {
      this.mode = null;
    },
    adapter: { redraw() {} },
    surface: { focus() {} },
  });
  Object.assign(transform, {
    editor,
    ids: ['rect', 'circle'],
    view: 'top',
    phase: 'base',
    numericAngle: null,
    ui() {},
  });
  const before = structuredClone(editor.items);
  transform.down({});
  assert.equal(transform.phase, 'angle-reference');
  point = [20, 20];
  transform.down({});
  assert.equal(transform.phase, 'destination');
  assert.deepEqual(editor.items, before);
  point = [10, 30];
  transform.down({});
  assert.equal(editor.history.length, 1);
  assert.equal(editor.items[0].shape, 'polyline');
  near(editor.items[0].points[1][0], 10);
  near(editor.items[0].points[1][1], 40);
  assert.deepEqual(editor.items[2], before[2]);
  const after = structuredClone(editor.items);
  editor.undo();
  assert.deepEqual(editor.items, before);
  editor.undo(true);
  assert.deepEqual(editor.items, after);
});
