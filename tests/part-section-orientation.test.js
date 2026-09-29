import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { sectionFrame } from '../src/drawing-sections.js';
import { PartSections } from '../src/part-sections.js';
import { migratePartOrientation } from '../src/part-section-orientation.js';
import { partViewFrame } from '../src/part-view-frame.js';
const front = { origin: [0, 0, 0], x: [1, 0, 0], y: [0, 0, 1], normal: [0, -1, 0] };
test('handedness correction migrates top points and preserves section viewing side once', () => {
  const top = { id: 'top', source: {}, camera: { center: [20, 30] }, size: [100, 50] };
  const cut = {
    id: 'cut',
    source: { parentViewId: 'top' },
    camera: { center: [30, 40] },
    size: [80, 50],
    section: {
      points: [
        [10, 20],
        [10, 80],
      ],
      side: 1,
      depth: 200,
    },
  };
  const record = {
    sheet: { sectionOrientation: 'source-up', views: [top, cut] },
    annotations: [
      {
        view: 'top',
        points: [
          [10, 20],
          [50, 40],
        ],
        line: [60, 70],
        kind: 'free',
        axis: [2, 1],
        references: [{ shape: 'old' }],
      },
    ],
  };
  const frame = (v) =>
    v.section
      ? sectionFrame(partViewFrame('top'), v.section.points, v.section.side, 'source')
      : partViewFrame(v.id);
  const reflection = new THREE.Matrix4().makeScale(1, -1, 1);
  const wanted = new THREE.Vector3(...frame(cut).normal).transformDirection(reflection);
  migratePartOrientation(record, frame, reflection);
  assert.deepEqual(record.annotations[0].points, [
    [10, -20],
    [50, -40],
  ]);
  assert.deepEqual(record.annotations[0].line, [60, -70]);
  assert.deepEqual(cut.section.points, [
    [10, -20],
    [10, -80],
  ]);
  assert.equal(cut.section.side, -1);
  assert.ok(wanted.dot(new THREE.Vector3(...frame(cut).normal)) > 0.999);
  assert.equal(record.annotations[0].references[0].shape, 'orientation:old');
  const copy = structuredClone(record);
  migratePartOrientation(record, frame, reflection);
  assert.deepEqual(record, copy);
});
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
test('existing section annotations and viewport are re-expressed once', () => {
  const source = { id: 'front', source: {}, camera: { center: [0, 0] }, size: [100, 50] };
  const section = {
    id: 'cut',
    source: { parentViewId: 'front' },
    section: {
      points: [
        [10, 0],
        [10, 100],
      ],
      side: 1,
    },
    camera: { center: [20, 30] },
    size: [40, 60],
  };
  const record = {
    sheet: { views: [source, section], sectionOrientation: 'source' },
    annotations: [
      { view: 'cut', points: [[20, 30]], line: [40, 50], kind: 'horizontal', axis: [1, 0] },
    ],
  };
  const frame = (v, mode) =>
    v.id === 'front' ? front : sectionFrame(front, v.section.points, v.section.side, mode);
  migratePartOrientation(record, frame);
  assert.deepEqual(section.camera.center, [-30, 20]);
  assert.deepEqual(section.size, [60, 40]);
  assert.deepEqual(record.annotations[0].points, [[-30, 20]]);
  assert.equal(record.annotations[0].kind, 'vertical');
  const copy = structuredClone(record);
  migratePartOrientation(record, frame);
  assert.deepEqual(record, copy);
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
