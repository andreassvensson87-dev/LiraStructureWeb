import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translatedShapes, rotatedShapes } from '../src/drawing-object-transform.js';
import { DrawingShapeTransform } from '../src/drawing-shape-transform.js';
import { validateShape, shapeContours } from '../src/drawing-shapes.js';
import { hatchSegments } from '../src/material-hatch.js';
import { locateDrawingPoint } from '../src/drawing-point-placement.js';
import { defaultCadSettings } from '../src/cad-statusbar.js';
import { CadTracking } from '../src/cad-tracking.js';

test('preselected drawings start at the base point; a mixed-view selection remains untouched', () => {
  const items = [
    { id: 'a', type: 'shape', view: 'v' },
    { id: 'b', type: 'shape', view: 'v' },
  ];
  const editor = {
    items,
    selectedIds: new Set(['a', 'b']),
    item: () => items[1],
    start(mode) {
      this.mode = mode;
    },
    hint: {},
  };
  const tool = Object.assign(Object.create(DrawingShapeTransform.prototype), { editor });
  tool.start('copy-shapes');
  assert.equal(tool.phase, 'base');
  assert.deepEqual(tool.ids, ['a', 'b']);
  items[1].view = 'other';
  tool.start('rotate-shapes');
  assert.equal(editor.mode, 'copy-shapes');
  assert.match(editor.hint.textContent, /samma vy/);
});

test('text, leader and dimension transformations preserve content and release stale anchors without changing originals', () => {
  const dimension = {
    id: 'd',
    type: 'dimension',
    view: 'v',
    kind: 'horizontal',
    points: [
      [0, 0],
      [100, 0],
    ],
    line: [0, 20],
    references: [{ source: 'part' }, null],
    dimensionLinkId: 'old',
    sourceId: 'part',
  };
  const leader = {
    id: 'l',
    type: 'leader',
    view: 'v',
    points: [[20, 30]],
    line: [50, 60],
    sourceId: 'part',
    references: [{ source: 'part' }],
    comment: 'P100',
  };
  const items = [dimension, leader],
    before = structuredClone(items);
  const copies = translatedShapes(items, ['d', 'l'], [0, 0], [10, 15], true);
  assert.deepEqual(items, before);
  assert.deepEqual(copies[0].points, [
    [10, 15],
    [110, 15],
  ]);
  assert.deepEqual(copies[0].line, [10, 35]);
  assert.deepEqual(copies[0].references, [null, null]);
  assert.notEqual(copies[0].dimensionLinkId, 'old');
  assert.equal(copies[0].sourceId, undefined);
  assert.equal(copies[1].sourceId, 'part');
  assert.deepEqual(copies[1].line, [60, 75]);
  const rotated = rotatedShapes(items, ['d', 'l'], [0, 0], Math.PI / 2);
  assert.ok(Math.abs(rotated[0].axis[0]) < 1e-8);
  assert.equal(rotated[0].kind, 'free');
  const text = {
    id: 't',
    type: 'richtext',
    view: 'paper',
    points: [[10, 20]],
    width: 80,
    rotation: 10,
    paragraphs: [{ runs: [{ text: 'B100', bold: true }] }],
    drawOrder: 'back',
  };
  const result = rotatedShapes([text], ['t'], [10, 20], -Math.PI / 2)[0];
  assert.equal(result.rotation, -80);
  assert.equal(result.width, 80);
  assert.deepEqual(result.paragraphs, text.paragraphs);
  assert.equal(result.drawOrder, 'back');
});

test('closed polygon validation and hatch use the same boundary after transforms', () => {
  assert.throws(() =>
    validateShape('polygon', [
      [0, 0],
      [10, 0],
    ]),
  );
  assert.throws(() =>
    validateShape('polygon', [
      [0, 0],
      [10, 0],
      [20, 0],
    ]),
  );
  assert.throws(() =>
    validateShape('polygon', [
      [0, 0],
      [10, 10],
      [0, 10],
      [10, 0],
    ]),
  );
  const item = {
    id: 'p',
    type: 'shape',
    view: 'v',
    shape: 'polygon',
    closed: true,
    points: [
      [0, 0],
      [40, 0],
      [40, 20],
      [0, 20],
    ],
    hatch: { pattern: 'diagonal', angle: 45, spacing: 2.5, lineWidth: 0.18 },
    drawOrder: 'back',
  };
  validateShape(item.shape, item.points);
  const copy = translatedShapes([item], ['p'], [0, 0], [50, 50], true)[0];
  const lines = hatchSegments(shapeContours(copy), copy.hatch);
  assert.ok(lines.length > 0);
  assert.ok(
    lines
      .flat()
      .every(([x, y]) => x >= 50 - 1e-8 && x <= 90 + 1e-8 && y >= 50 - 1e-8 && y <= 70 + 1e-8),
  );
  assert.equal(copy.drawOrder, 'back');
  copy.hatch.spacing = 10;
  assert.equal(item.hatch.spacing, 2.5);
  const circle = {
    ...item,
    shape: 'circle',
    closed: false,
    points: [
      [0, 0],
      [10, 0],
    ],
  };
  assert.equal(shapeContours(circle)[0].length, 128);
  assert.ok(
    hatchSegments(shapeContours(circle), item.hatch)
      .flat()
      .every((p) => Math.hypot(...p) <= 10 + 1e-7),
  );
});

test('snap kinds survive point resolution; closed edges, circle centers and quadrants use existing settings', () => {
  let point = [20, 20];
  const polygon = {
    id: 'p',
    type: 'shape',
    shape: 'polygon',
    view: 'v',
    points: [
      [0, 0],
      [40, 0],
      [40, 40],
    ],
    closed: true,
  };
  const circle = {
    id: 'c',
    type: 'shape',
    shape: 'circle',
    view: 'v',
    points: [
      [100, 100],
      [120, 100],
    ],
  };
  const editor = {
    items: [polygon, circle],
    cad: { get: () => defaultCadSettings, coordinates() {} },
    tracking: new CadTracking(),
    adapter: {
      locate: () => ({ view: 'v', point: [...point] }),
      project: (p) => p,
      pixelScale: () => 1,
      candidates: () => [],
    },
  };
  const hit = () => locateDrawingPoint(editor, { clientX: 0, clientY: 0 }, 'v');
  assert.equal(hit().kind, 'Mittpunkt');
  point = [100, 101];
  assert.equal(hit().kind, 'Centrum');
  point = [100, 120];
  assert.equal(hit().kind, 'Kvadrant');
  editor.cad.get = () => ({ ...defaultCadSettings, centers: false, quadrants: false });
  assert.equal(hit().snapped, undefined);
});
