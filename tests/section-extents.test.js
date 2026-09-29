import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { extentGeometry, resizeSectionExtent } from '../src/section-extents.js';
import { sectionFrame, sectionDrawing } from '../src/drawing-sections.js';
import { DrawingSectionTool } from '../src/drawing-section-tool.js';
const plan = { origin: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], normal: [0, 0, 1] };
const front = { origin: [0, 0, 0], x: [1, 0, 0], y: [0, 0, 1], normal: [0, -1, 0] };
const section = {
  points: [
    [0, 0],
    [100, 0],
  ],
  side: 1,
  depth: 50,
};
test('selected GA marker takes extent depth from its owning section view', () => {
  const view = { id: 'cut', section: structuredClone(section) };
  const marker = { id: 'cut', section: { points: section.points, side: 1, label: 'A' } };
  const tool = Object.create(DrawingSectionTool.prototype);
  let drawn;
  Object.assign(tool, {
    selectedMarker: 'cut',
    adapter: { views: () => [view], markers: () => [marker], selected: () => ({ id: 'plan' }) },
    feedback: { paint() {} },
    line() {},
    extents(root, definition) {
      drawn = extentGeometry(definition);
    },
  });
  tool.paint({}, 'plan', (p) => p);
  assert.deepEqual(drawn.rear, [
    [0, 50],
    [100, 50],
  ]);
  assert.ok(drawn.handles.flat().every(Number.isFinite));
  drawn = null;
  tool.selectedMarker = null;
  tool.paint({}, 'plan', (p) => p);
  assert.equal(drawn, null);
});
test('middle grip translates orthogonally without changing length, angle, side or depth', () => {
  for (const points of [
    [
      [0, 0],
      [100, 0],
    ],
    [
      [20, -50],
      [20, 80],
    ],
    [
      [10, 20],
      [70, 100],
    ],
  ]) {
    for (const side of [1, -1]) {
      const source = { ...section, points, side };
      const before = structuredClone(source);
      const { axis, normal } = extentGeometry(source);
      const center = points[0].map((n, i) => (n + points[1][i]) / 2);
      const target = center.map((n, i) => n + normal[i] * 40 + axis[i] * 29);
      const moved = resizeSectionExtent(source, 'move', target);
      for (let j = 0; j < 2; j++)
        for (let i = 0; i < 2; i++)
          assert.ok(Math.abs(moved.points[j][i] - points[j][i] - normal[i] * 40) < 1e-8);
      assert.equal(moved.depth, source.depth);
      assert.equal(moved.side, side);
      assert.deepEqual(source, before);
    }
  }
});
test('middle grip click-click commits projected target and clears command', () => {
  const view = { id: 'cut', section: structuredClone(section) };
  const tool = Object.create(DrawingSectionTool.prototype);
  let updated = 0;
  Object.assign(tool, {
    draft: {
      edit: 'cut',
      extent: 'move',
      section: structuredClone(section),
      points: section.points,
    },
    feedback: { select: () => false, locate: () => ({ point: [80, 25] }) },
    adapter: { views: () => [view], update: () => updated++ },
    cancel() {
      this.draft = null;
    },
  });
  assert.deepEqual(tool.constrainHit({ point: [80, 25], snapped: true }).point, [50, 25]);
  assert.equal(tool.constrainHit({ point: [80, 25], snapped: true }).snapped, false);
  assert.equal(tool.constrainHit({ point: [50, 25], snapped: true }).snapped, true);
  tool.down({
    button: 0,
    target: { closest: () => ({ dataset: { sectionId: 'cut', sectionExtent: 'move' } }) },
    preventDefault() {},
    stopImmediatePropagation() {},
  });
  assert.deepEqual(view.section.points, [
    [0, 25],
    [100, 25],
  ]);
  assert.equal(updated, 1);
  assert.equal(tool.draft, null);
});
test('extent grips resize on fixed axes without rotating the cutting line', () => {
  const result = resizeSectionExtent(section, 'end', [200, 30]);
  assert.deepEqual(result.points, [
    [0, 0],
    [200, 0],
  ]);
  assert.equal(resizeSectionExtent(section, 'depth', [15, 80]).depth, 80);
  assert.equal(resizeSectionExtent(section, 'depth', [15, -80]).depth, 0.1);
  assert.deepEqual(extentGeometry(section).rear, [
    [0, 50],
    [100, 50],
  ]);
  assert.deepEqual(section.points, [
    [0, 0],
    [100, 0],
  ]);
});
test('section geometry and snap edges obey finite width as well as depth', () => {
  const g = new THREE.BoxGeometry(100, 100, 100);
  const frame = sectionFrame(
    plan,
    [
      [-10, 0],
      [20, 0],
    ],
    1,
  );
  const data = sectionDrawing([g], frame, 20);
  assert.ok(data.cut.length);
  for (const p of [...data.cut, ...data.behind].flat())
    assert.ok(p[0] >= -1e-6 && p[0] <= 30 + 1e-6);
  g.dispose();
});
test('upright vertical sections clip their height along the drawn line', () => {
  const g = new THREE.BoxGeometry(100, 100, 100);
  const frame = sectionFrame(
    front,
    [
      [0, -10],
      [0, 20],
    ],
    1,
  );
  const data = sectionDrawing([g], frame, 20);
  assert.deepEqual(frame.y, [0, 0, 1]);
  for (const p of [...data.cut, ...data.behind].flat())
    assert.ok(p[1] >= -1e-6 && p[1] <= 30 + 1e-6);
  g.dispose();
});
test('second click on a preview grip commits instead of restarting the extent command', () => {
  const view = { id: 'cut', section: structuredClone(section) };
  const tool = Object.create(DrawingSectionTool.prototype);
  let committed = false;
  Object.assign(tool, {
    draft: {
      edit: 'cut',
      extent: 'depth',
      section: structuredClone(section),
      points: section.points,
    },
    feedback: { select: () => false, locate: () => ({ point: [40, 80] }) },
    adapter: {
      views: () => [view],
      update: () => {
        committed = true;
      },
    },
    cancel() {
      this.draft = null;
    },
  });
  tool.down({
    button: 0,
    target: { closest: () => ({ dataset: { sectionId: 'cut', sectionExtent: 'depth' } }) },
    preventDefault() {},
    stopImmediatePropagation() {},
  });
  assert.equal(committed, true);
  assert.equal(view.section.depth, 80);
  assert.equal(tool.draft, null);
});
