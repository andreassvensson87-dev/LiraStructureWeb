import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { sectionFrame } from '../src/drawing-sections.js';
import { PartSections } from '../src/part-sections.js';
import { partViewFrame } from '../src/part-view-frame.js';
const front = { origin: [0, 0, 0], x: [1, 0, 0], y: [0, 0, 1], normal: [0, -1, 0] };
test('Single Part orientation follows the source and line, not global Z', () => {
  const points = [
      [10, 0],
      [10, 100],
    ],
    f = sectionFrame(front, points, 1, 'source');
  assert.deepEqual(f.y, [0, 0, 1]);
  assert.deepEqual(f.x, [0, 1, 0]);
  const reverse = sectionFrame(front, points, -1, 'source');
  assert.deepEqual(reverse.y, f.y);
  assert.deepEqual(reverse.x, [0, -1, 0]);
  assert.deepEqual(sectionFrame(front, points, 1).y, [0, 0, 1]);
});
test('only the original view receives a Single Part section marker', () => {
  const controller = Object.create(PartSections.prototype);
  controller.e = {
    config: {
      views: [
        { id: 'a', section: {}, source: { parentViewId: 'front' } },
        { id: 'b', section: {}, source: { parentViewId: 'a' } },
      ],
    },
  };
  assert.deepEqual(
    controller.markers('front').map((v) => v.id),
    ['a'],
  );
  assert.deepEqual(controller.markers('top'), []);
  assert.deepEqual(
    controller.markers('a').map((v) => v.id),
    ['b'],
  );
});
test('source up follows a rotated parent and horizontal cuts have a stable fallback', () => {
  const rotated = { origin: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], normal: [0, 0, 1] };
  const vertical = sectionFrame(
    rotated,
    [
      [0, 0],
      [0, 100],
    ],
    1,
    'source',
  );
  assert.deepEqual(vertical.y, rotated.y);
  const horizontal = sectionFrame(
    front,
    [
      [0, 0],
      [100, 0],
    ],
    1,
    'source',
  );
  assert.deepEqual(horizontal.y, front.normal);
  const opposite = sectionFrame(
    front,
    [
      [0, 0],
      [100, 0],
    ],
    -1,
    'source',
  );
  assert.deepEqual(opposite.y, horizontal.y);
});
