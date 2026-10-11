import test from 'node:test';
import assert from 'node:assert/strict';
import { drawingOcclusionIndex } from '../src/drawing-occlusion-index.js';

test('occlusion bounds retain all possible covers once, including coincident and narrow faces', () => {
  let seed = 123;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const faces = Array.from({ length: 300 }, (_, id) => {
    const x = random() * 100,
      y = random() * 100,
      z = random() * 20;
    const w = id % 3 ? random() * 20 : 0,
      h = random() * 20;
    return {
      id,
      box: [x, y, x + w, y + h],
      points: [
        [x, y, z],
        [x + w, y, z + 2],
        [x, y + h, z - 2],
      ],
    };
  });
  faces.push(...Array.from({ length: 40 }, (_, i) => ({ ...faces[0], id: 300 + i })));
  const original = faces.slice(),
    query = drawingOcclusionIndex(faces);
  for (let i = 0; i < 200; i++) {
    const x = random() * 120,
      y = random() * 120,
      minZ = random() * 25;
    const box = [x, y, x + random() * 30, y + random() * 30];
    const found = [];
    query(box, minZ, (face) => found.push(face));
    const expected = faces.filter(
      (t) =>
        box[0] <= t.box[2] &&
        box[2] >= t.box[0] &&
        box[1] <= t.box[3] &&
        box[3] >= t.box[1] &&
        Math.max(...t.points.map((p) => p[2])) >= minZ - 0.001,
    );
    assert.equal(new Set(found).size, found.length);
    for (const t of expected) assert.ok(found.includes(t), `missing cover ${t.id}`);
    for (const t of found)
      assert.ok(
        box[0] <= t.box[2] && box[2] >= t.box[0] && box[1] <= t.box[3] && box[3] >= t.box[1],
      );
  }
  assert.deepEqual(faces, original);
});

test('empty geometry and touching bounds are valid queries', () => {
  drawingOcclusionIndex([])([0, 0, 1, 1], 0, () => assert.fail('empty index'));
  const face = {
    box: [0, 0, 1, 1],
    points: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ],
  };
  const found = [];
  drawingOcclusionIndex([face])([1, 1, 2, 2], 0, (t) => found.push(t));
  assert.deepEqual(found, [face]);
});
