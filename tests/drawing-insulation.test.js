import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insulationFrame, insulationPatternPath } from '../src/drawing-insulation.js';
import { shapeSnapPoints, shapeContours } from '../src/drawing-shapes.js';
import { shapeGrips, shapeWithGrip } from '../src/drawing-shape-grips.js';
import { translatedShapes, rotatedShapes } from '../src/drawing-object-transform.js';
import { DrawingAnnotations } from '../src/drawing-annotations.js';
import { shapeToolSettings } from '../src/drawing-shape-style.js';
import { mergeDrawingEdit } from '../src/project/drawing-edits.js';

const band = () => ({
  id: 'insulation',
  type: 'shape',
  shape: 'insulation',
  view: 'front',
  points: [
    [10, 20],
    [410, 20],
  ],
  thickness: 100,
  insulationType: 'soft',
  side: 'left',
});
const close = (actual, expected) =>
  actual.forEach((point, i) =>
    point.forEach((v, j) => assert.ok(Math.abs(v - expected[i][j]) < 1e-8)),
  );

test('insulation boundary, snap corners and side follow an inclined baseline', () => {
  const original = band();
  assert.deepEqual(shapeSnapPoints(original), [
    [10, 20],
    [410, 20],
    [410, 120],
    [10, 120],
  ]);
  assert.deepEqual(shapeContours(original), [shapeSnapPoints(original)]);
  const rotated = rotatedShapes([original], [original.id], [10, 20], Math.PI / 3)[0];
  assert.equal(insulationFrame(rotated).thickness, 100);
  assert.ok(Math.abs(insulationFrame(rotated).length - 400) < 1e-8);
  const corners = shapeSnapPoints(original).map(([x, y]) => [
    10 + (x - 10) * 0.5 - (y - 20) * Math.sin(Math.PI / 3),
    20 + (x - 10) * Math.sin(Math.PI / 3) + (y - 20) * 0.5,
  ]);
  close(shapeSnapPoints(rotated), corners);
  original.side = 'right';
  assert.deepEqual(shapeSnapPoints(original).slice(2), [
    [410, -80],
    [10, -80],
  ]);
  const copied = translatedShapes([rotated], [rotated.id], [0, 0], [50, 70], true)[0];
  assert.notEqual(copied.id, rotated.id);
  close(
    shapeSnapPoints(copied),
    corners.map((p) => [p[0] + 50, p[1] + 70]),
  );
});

test('thickness grip changes only the perpendicular height, permits side flip, and rejects zero height', () => {
  const original = band();
  const grip = shapeGrips(original).find((g) => g.kind === 'thickness');
  const changed = shapeWithGrip(original, grip, [350, 170]);
  assert.deepEqual(changed.points, original.points);
  assert.equal(changed.thickness, 150);
  assert.equal(original.thickness, 100);
  const flipped = shapeWithGrip(original, grip, [210, -30]);
  assert.equal(flipped.thickness, 50);
  assert.equal(flipped.side, 'right');
  assert.throws(() => shapeWithGrip(original, grip, [210, 20]), /positiv/);
  assert.throws(
    () => shapeWithGrip(original, shapeGrips(original)[1], original.points[0]),
    /olika/,
  );
  const inclined = rotatedShapes([original], [original.id], original.points[0], Math.PI / 4)[0];
  const frame = insulationFrame(inclined);
  const next = shapeWithGrip(inclined, shapeGrips(inclined)[2], frame.point(330, 75));
  assert.ok(Math.abs(next.thickness - 75) < 1e-8);
  assert.deepEqual(next.points, inclined.points);
});

test('soft curves and hard triangles project in drawing units and stay bounded for extreme aspect ratios', () => {
  const item = band();
  const project = ([x, y]) => [x / 20, -y / 20];
  const soft = insulationPatternPath(item, project);
  assert.match(soft, /^M3,-1C/);
  assert.equal((soft.match(/C/g) || []).length, 16);
  item.insulationType = 'hard';
  const hard = insulationPatternPath(item, project);
  assert.match(hard, /^M0.5,-1L3,-6L5.5,-1/);
  assert.ok(hard.endsWith('L20.5,-1'));
  item.points[1] = [1e9, 20];
  assert.equal((insulationPatternPath(item, project).match(/L/g) || []).length, 4096);
  assert.equal(shapeSnapPoints(item).length, 4);
  for (const thickness of [0, -1, NaN, Infinity])
    assert.throws(() => insulationFrame({ ...item, thickness }));
});

test('two-point creation selects insulation for grip editing and retains tool values through undo, redo and project edits', () => {
  const editor = Object.create(DrawingAnnotations.prototype);
  Object.assign(editor, {
    items: [],
    history: [],
    future: [],
    selectedIds: new Set(),
    contextMenu: { close() {}, isOpen: () => false },
    surface: { setAttribute() {}, focus() {} },
    adapter: { redraw() {} },
    ui() {},
  });
  editor.record = { id: 'drawing', annotations: editor.items };
  Object.assign(shapeToolSettings(editor.record, 'insulation'), {
    thickness: 120,
    insulationType: 'hard',
    side: 'right',
  });
  editor.start('insulation', 'shape');
  let hit;
  editor.location = () => hit;
  for (const point of [
    [0, 0],
    [500, 0],
  ]) {
    hit = { point, view: 'front' };
    editor.down({
      button: 0,
      target: { closest: () => null },
      preventDefault() {},
      stopImmediatePropagation() {},
    });
  }
  assert.equal(editor.items.length, 1);
  assert.equal(editor.mode, null);
  assert.equal(editor.selected, editor.items[0].id);
  assert.equal(editor.items[0].thickness, 120);
  assert.equal(editor.items[0].insulationType, 'hard');
  assert.equal(editor.history.length, 1);
  editor.undo();
  assert.equal(editor.items.length, 0);
  editor.undo(true);
  assert.equal(editor.items.length, 1);
  const saved = JSON.parse(
    JSON.stringify(mergeDrawingEdit([{ id: 'drawing', annotations: [] }], editor.record)),
  );
  assert.deepEqual(saved[0].annotations, editor.items);
  assert.deepEqual(shapeSnapPoints(saved[0].annotations[0]), [
    [0, 0],
    [500, 0],
    [500, -120],
    [0, -120],
  ]);
});
