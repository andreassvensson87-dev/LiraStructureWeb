import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { extentGeometry, resizeSectionExtent } from '../src/section-extents.js';
import { sectionFrame, sectionDrawing } from '../src/drawing-sections.js';
import { beginDrawingMarkerGrip } from '../src/drawing-marker-grip-editor.js';
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
test('external section marker renders after the section tool has been cancelled', () => {
  const marker = { section: { ...section, label: 'A / GA-002' } };
  const tool = Object.create(DrawingSectionTool.prototype);
  let drawn;
  Object.assign(tool, {
    draft: null,
    adapter: { views: () => [], markers: () => [marker] },
    feedback: { paint() {} },
    line(root, points, side, label) {
      drawn = { points, side, label };
    },
  });
  tool.paint({}, 'plan', (p) => p);
  assert.deepEqual(drawn, { points: section.points, side: 1, label: 'A / GA-002' });
});
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
test('section move grip previews locally, projects onto its normal and commits once with undo', () => {
  const view = {
    id: 'cut',
    scale: 10,
    camera: { center: [3, 4] },
    source: { parentViewId: 'plan' },
    section: structuredClone(section),
  };
  const before = structuredClone(view);
  const tool = Object.create(DrawingSectionTool.prototype);
  let updates = 0,
    previews = 0,
    operation;
  Object.assign(tool, {
    feedback: {
      type: 'section',
      locate: () => ({ point: [80, 25] }),
      repaint() {
        previews++;
      },
    },
    adapter: {
      views: () => [view],
      cancel() {},
      redraw() {},
      update(v, options) {
        updates++;
        if (options?.recenter !== false) v.camera.center = [9, 9];
      },
      feedback: {
        recordOperation(a, b, restore) {
          operation = { a, b, restore };
        },
      },
    },
    cancel() {
      this.draft = null;
    },
  });
  const session = beginDrawingMarkerGrip(
    tool,
    {},
    { dataset: { sectionId: 'cut', sectionExtent: 'move' }, getAttribute: () => '' },
  );
  assert.deepEqual(tool.constrainHit({ point: [80, 25], snapped: true }).point, [50, 25]);
  session.apply(session.locate({}));
  session.preview();
  assert.deepEqual(view, before);
  assert.equal(previews, 1);
  assert.equal(updates, 0);
  session.commit();
  assert.deepEqual(view.section.points, [
    [0, 25],
    [100, 25],
  ]);
  assert.equal(updates, 1);
  operation.restore(operation.a);
  assert.deepEqual(view, before);
  operation.restore(operation.b);
  assert.deepEqual(view.section.points, [
    [0, 25],
    [100, 25],
  ]);
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
test('depth grip cancel leaves section geometry untouched and invalid endpoints cannot commit a stale draft', () => {
  const view = { id: 'cut', source: { parentViewId: 'plan' }, section: structuredClone(section) };
  const before = structuredClone(view);
  const tool = {
    feedback: { type: 'section', repaint() {} },
    adapter: {
      views: () => [view],
      cancel() {},
      redraw() {},
      update() {
        throw Error('unexpected projection');
      },
      feedback: {},
    },
    cancel() {
      this.draft = null;
    },
  };
  const grip = (dataset) =>
    beginDrawingMarkerGrip(
      tool,
      {},
      { dataset: { sectionId: 'cut', ...dataset }, getAttribute: () => '' },
    );
  const depth = grip({ sectionExtent: 'depth' });
  depth.apply({ point: [30, 80] });
  depth.preview();
  depth.cancel();
  assert.deepEqual(view, before);
  assert.equal(tool.draft, null);
  const endpoint = grip({ sectionEndpoint: '0' });
  assert.throws(() => endpoint.apply({ point: [100, 0] }), /sammanfalla/);
  endpoint.cancel();
  assert.deepEqual(view, before);
});

test('detail marker uses local draft, validates area and records one reversible operation', () => {
  const view = {
    id: 'detail',
    source: { parentViewId: 'plan' },
    scale: 5,
    size: [20, 20],
    camera: { center: [50, 50] },
    detail: {
      points: [
        [0, 0],
        [100, 100],
      ],
      label: '1',
    },
  };
  const before = structuredClone(view);
  let updates = 0,
    operation;
  const tool = {
    feedback: { type: 'detail', repaint() {} },
    adapter: {
      views: () => [view],
      cancel() {},
      redraw() {},
      update() {
        updates++;
      },
      feedback: {
        recordOperation(a, b, restore) {
          operation = { a, b, restore };
        },
      },
    },
    cancel() {
      this.draft = null;
    },
  };
  const session = beginDrawingMarkerGrip(
    tool,
    {},
    { dataset: { detailId: 'detail', detailCorner: '1' }, getAttribute: () => '' },
  );
  session.apply({ point: [150, 120] });
  session.preview();
  assert.deepEqual(view, before);
  assert.equal(updates, 0);
  assert.throws(() => session.apply({ point: [0, 0] }), /bredd/);
  session.apply({ point: [150, 120] });
  session.commit();
  assert.equal(updates, 1);
  assert.deepEqual(view.size, [30, 24]);
  operation.restore(operation.a);
  assert.deepEqual(view, before);
  operation.restore(operation.b);
  assert.deepEqual(view.detail.points, [
    [0, 0],
    [150, 120],
  ]);
});
