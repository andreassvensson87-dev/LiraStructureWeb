import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  shapeStyle,
  shapeToolSettings,
  applyShapeToolSettings,
} from '../src/drawing-shape-style.js';
import { translatedShapes, rotatedShapes } from '../src/drawing-shape-transform.js';
test('shape styles use paper millimeters for thickness and dash patterns', () => {
  const style = shapeStyle(
    { strokeColor: '#ff0000', strokeWidth: 0.5, lineType: 'center', fillColor: '#ddeeff' },
    {},
    4,
  );
  assert.equal(style.color, '#ff0000');
  assert.equal(style.width, 2);
  assert.equal(style.dash, '32 8 4 8');
  assert.equal(style.fill, '#ddeeff');
  assert.equal(shapeStyle({ lineType: 'solid' }).dash, '');
});
test('legacy shapes inherit drawing thickness and invalid fields fall back safely', () => {
  const style = shapeStyle(
    { strokeColor: 'invalid', strokeWidth: -1, lineType: 'invalid', fillColor: 'invalid' },
    { lineWidth: 0.35 },
  );
  assert.deepEqual(style, {
    color: '#263a42',
    width: 0.35,
    lineType: 'solid',
    dash: '',
    fill: 'none',
  });
});
test('saved shape styles survive copying and rotating without affecting originals', () => {
  const original = {
    id: 'rect',
    type: 'shape',
    shape: 'rectangle',
    view: 'top',
    points: [
      [0, 0],
      [20, 10],
    ],
    strokeColor: '#aabbcc',
    strokeWidth: 0.6,
    lineType: 'dashed',
    fillColor: '#123456',
  };
  const stored = JSON.parse(JSON.stringify(original));
  const copy = translatedShapes([stored], ['rect'], [0, 0], [30, 0], true)[0];
  const rotated = rotatedShapes([copy], [copy.id], [0, 0], Math.PI / 4)[0];
  assert.deepEqual(shapeStyle(rotated), shapeStyle(original));
  copy.strokeColor = '#ff0000';
  assert.equal(original.strokeColor, '#aabbcc');
});
test('tool settings are retained per tool and copied into drafts without altering existing objects', () => {
  const record = {};
  const settings = shapeToolSettings(record, 'circle');
  settings.strokeColor = '#123456';
  settings.strokeWidth = 0.6;
  const first = applyShapeToolSettings({ type: 'shape', shape: 'circle', points: [] }, settings);
  settings.strokeWidth = 0.9;
  assert.equal(first.strokeWidth, 0.6);
  assert.equal(shapeToolSettings(record, 'rectangle').strokeWidth, undefined);
  const saved = JSON.parse(JSON.stringify(record));
  assert.equal(shapeToolSettings(saved, 'circle').strokeWidth, 0.9);
  applyShapeToolSettings(first, settings);
  assert.equal(first.strokeWidth, 0.9);
  delete settings.strokeWidth;
  applyShapeToolSettings(first, settings);
  assert.equal(first.strokeWidth, undefined);
});
