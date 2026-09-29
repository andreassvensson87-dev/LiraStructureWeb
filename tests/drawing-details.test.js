import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDetailView,
  updateDetailArea,
  detailSource,
  syncDetailCrop,
  detailBounds,
} from '../src/drawing-details.js';
import { cropDrawingView } from '../src/drawing-views.js';
const parent = {
  id: 'front',
  projection: 'front',
  scale: 10,
  source: { type: 'part', objectId: 'p1' },
  settings: { hiddenLines: true },
};
test('detail keeps source coordinates and independent scale and placement', () => {
  const points = [
      [300, 200],
      [100, 50],
    ],
    v = createDetailView(parent, points, [40, 60], []);
  assert.deepEqual(v.camera.center, [200, 125]);
  assert.deepEqual(v.size, [40, 30]);
  assert.equal(v.scale, 5);
  assert.equal(v.source.parentViewId, 'front');
  assert.deepEqual(v.position, [40, 60]);
  v.settings.hiddenLines = false;
  assert.equal(parent.settings.hiddenLines, true);
  points[0][0] = 900;
  assert.equal(v.detail.points[0][0], 300);
  v.scale = 2;
  updateDetailArea(v);
  assert.deepEqual(v.size, [100, 75]);
  assert.deepEqual(v.camera.center, [200, 125]);
});
test('detail crop remains consistent with its source rectangle', () => {
  const v = createDetailView(
      parent,
      [
        [0, 0],
        [500, 300],
      ],
      [40, 60],
      [],
    ),
    cropped = cropDrawingView(v, 'nw', [10, 5]);
  syncDetailCrop(cropped);
  const size = [...cropped.size],
    center = [...cropped.camera.center];
  updateDetailArea(cropped);
  assert.deepEqual(cropped.size, size);
  assert.deepEqual(cropped.camera.center, center);
});
test('nested details resolve source and avoid duplicate labels', () => {
  const a = createDetailView(
      parent,
      [
        [0, 0],
        [500, 300],
      ],
      [0, 0],
      [],
    ),
    b = createDetailView(
      a,
      [
        [10, 20],
        [100, 150],
      ],
      [0, 0],
      [a],
    );
  assert.equal(b.detail.label, '2');
  assert.equal(detailSource(b, [parent, a, b]), parent);
  assert.throws(() => detailSource(b, [b]));
  a.source.parentViewId = b.id;
  assert.throws(() => detailSource(b, [a, b]), /Cirkulär/);
});
test('detail requires a rectangle with two nonzero dimensions', () => {
  assert.throws(() =>
    detailBounds([
      [0, 0],
      [0, 2],
    ]),
  );
  assert.throws(() =>
    detailBounds([
      [0, 0],
      [2, 0],
    ]),
  );
});
