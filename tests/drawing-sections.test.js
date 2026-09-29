import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  sectionFrame,
  frameMatrix,
  sectionDrawing,
  createSectionView,
  nextSectionName,
} from '../src/drawing-sections.js';
const plan = { origin: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], normal: [0, 0, 1] };
test('section frame puts the cutting plane at zero and the chosen side behind it', () => {
  const frame = sectionFrame(
      plan,
      [
        [0, 0],
        [10, 0],
      ],
      1,
    ),
    matrix = frameMatrix(frame);
  assert.deepEqual(frame.x, [1, 0, 0]);
  assert.deepEqual(frame.y, [0, 0, 1]);
  assert.ok(new THREE.Vector3(5, 3, 7).applyMatrix4(matrix).z < 0);
  assert.ok(new THREE.Vector3(5, -3, 7).applyMatrix4(matrix).z > 0);
  assert.ok(
    new THREE.Vector3(5, -3, 7).applyMatrix4(
      frameMatrix(
        sectionFrame(
          plan,
          [
            [0, 0],
            [10, 0],
          ],
          -1,
        ),
      ),
    ).z < 0,
  );
});
test('cuts have finite depth and moving the line updates the cross section', () => {
  const geometry = new THREE.BoxGeometry(10, 10, 10),
    frame = sectionFrame(
      plan,
      [
        [-10, 0],
        [10, 0],
      ],
      1,
    );
  const drawing = sectionDrawing([geometry], frame, 2);
  assert.ok(drawing.cut.length >= 4);
  assert.ok(drawing.behind.length > 0);
  const empty = sectionDrawing(
    [geometry],
    sectionFrame(
      plan,
      [
        [-10, 20],
        [10, 20],
      ],
      1,
    ),
    2,
  );
  assert.equal(empty.cut.length, 0);
  assert.equal(empty.behind.length, 0);
  assert.throws(() => sectionDrawing([geometry], frame, 0));
  assert.throws(() =>
    sectionFrame(plan, [
      [0, 0],
      [0, 0],
    ]),
  );
  geometry.dispose();
});
test('section identities and references are independent, labels avoid existing A–A', () => {
  const parent = {
      id: 'front',
      source: { type: 'part', objectId: 'beam' },
      scale: 10,
      settings: {},
    },
    views = [{ id: 'section' }];
  const view = createSectionView(
    parent,
    [
      [0, 0],
      [1, 0],
    ],
    1,
    [50, 60],
    views,
  );
  assert.equal(view.section.label, 'B');
  assert.equal(view.source.parentViewId, 'front');
  assert.equal(view.scale, 10);
  assert.deepEqual(view.position, [50, 60]);
  assert.equal(nextSectionName([...views, view]), 'C');
});
test('nested sections remain orthonormal and use their parent coordinate system', () => {
  const parent = sectionFrame(
      plan,
      [
        [10, 20],
        [20, 30],
      ],
      1,
    ),
    child = sectionFrame(
      parent,
      [
        [0, 0],
        [0, 10],
      ],
      -1,
    );
  const x = new THREE.Vector3(...child.x),
    y = new THREE.Vector3(...child.y),
    n = new THREE.Vector3(...child.normal);
  assert.ok(Math.abs(x.dot(y)) < 1e-9);
  assert.ok(Math.abs(x.dot(n)) < 1e-9);
  assert.ok(Math.abs(n.length() - 1) < 1e-9);
  assert.deepEqual(child.origin, parent.origin);
});
