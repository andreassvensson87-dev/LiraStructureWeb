import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collectDrawingDefinitions,
  drawingDefinitions,
  referencesInView,
  captureDrawingDefinitions,
  modelViewFrame,
} from '../src/model-drawing-references.js';
import { createSectionView, frameMatrix } from '../src/drawing-sections.js';
import { createDetailView } from '../src/drawing-details.js';
import { migratePartSection } from '../src/part-section-migration.js';
import { ensurePartViews, syncPartViews } from '../src/drawing-views.js';
import * as THREE from 'three';
const levels = [
  { id: 'l1', elevation: 0 },
  { id: 'l2', elevation: 6000 },
];
function drawing(id) {
  return {
    id,
    number: 'GA-' + id,
    type: 'GA',
    sheet: {
      views: [
        {
          id: 'plan',
          source: { type: 'model' },
          projection: 'plan',
          settings: { levelId: 'l1', lower: -1000, cut: 1200, upper: 3000 },
          camera: { center: [0, 0] },
          size: [200, 200],
          position: [10, 10],
          scale: 10,
        },
      ],
    },
  };
}
function setup() {
  const record = drawing('1'),
    views = record.sheet.views;
  const section = createSectionView(
    views[0],
    [
      [-500, 0],
      [500, 0],
    ],
    1,
    [0, 0],
    views,
  );
  views.push(section);
  const detail = createDetailView(
    views[0],
    [
      [-100, -100],
      [100, 100],
    ],
    [20, 20],
    views,
  );
  views.push(detail);
  return { record, section, detail };
}
test('a new GA receives both section and detail references without copying views', () => {
  const { record } = setup(),
    next = drawing('2');
  const definitions = collectDrawingDefinitions(
    [record, { ...record, id: 'sp', type: 'SP' }],
    next,
    levels,
  );
  assert.equal(definitions.length, 2);
  const refs = referencesInView(definitions, next, next.sheet.views[0], levels);
  assert.deepEqual(
    refs.map((r) => r.kind),
    ['section', 'detail'],
  );
  assert.ok(refs.every((r) => r.drawingNumber === 'GA-1' && !r.local));
  assert.equal(next.sheet.views.length, 1);
});
test('references respect level, viewport bounds and per-view hidden settings', () => {
  const { record } = setup(),
    next = drawing('2'),
    view = next.sheet.views[0],
    defs = drawingDefinitions(record, levels);
  view.settings.levelId = 'l2';
  assert.equal(referencesInView(defs, next, view, levels).length, 0);
  view.settings.levelId = 'l1';
  view.camera.center = [10000, 10000];
  assert.equal(referencesInView(defs, next, view, levels).length, 0);
  view.camera.center = [0, 0];
  view.settings.hiddenReferences = [defs[0].id];
  assert.deepEqual(
    referencesInView(defs, next, view, levels).map((r) => r.kind),
    ['detail'],
  );
  assert.equal(referencesInView(defs, next, view, levels, true).length, 2);
});
test('detail taken from a section follows its parent and is only shown in compatible views', () => {
  const { record, section } = setup(),
    views = record.sheet.views;
  const detail = createDetailView(
    section,
    [
      [0, 0],
      [100, 100],
    ],
    [0, 0],
    views,
  );
  views.push(detail);
  let def = drawingDefinitions(record, levels).find((d) => d.viewId === detail.id);
  assert.equal(def.parentDefinitionId, `${record.id}:${section.id}`);
  const before = def.worldPoints;
  section.section.points = section.section.points.map(([x, y]) => [x, y + 250]);
  def = drawingDefinitions(record, levels).find((d) => d.viewId === detail.id);
  assert.equal(def.worldPoints[0][1] - before[0][1], 250);
  assert.equal(referencesInView([def], record, views[0], levels).length, 0);
  assert.equal(referencesInView([def], record, section, levels).length, 1);
});
test('model-space definitions persist with the owning view and an edited record replaces its old registry entry', () => {
  const { record } = setup();
  captureDrawingDefinitions(record, levels);
  const copy = JSON.parse(JSON.stringify(record));
  assert.equal(copy.sheet.views[1].modelReference.worldPoints[0][2], 1200);
  copy.sheet.views[1].section.points[0][0] = -800;
  const defs = collectDrawingDefinitions([record], copy, levels);
  assert.equal(defs.length, 2);
  assert.equal(defs[0].worldPoints[0][0], -800);
  assert.equal(record.sheet.views[1].section.points[0][0], -500);
});
test('vertical cut in a front view remains upright, changing side reverses horizontal direction', () => {
  const parent = {
    id: 'front',
    source: { type: 'model' },
    settings: {},
    camera: { center: [0, 0] },
    size: [100, 100],
    scale: 10,
  };
  // Direct sectionFrame orientation is tested on an asymmetric point.
  return import('../src/drawing-sections.js').then(({ sectionFrame }) => {
    const frame = { origin: [0, 0, 0], x: [1, 0, 0], y: [0, 0, 1], normal: [0, -1, 0] };
    const a = sectionFrame(
        frame,
        [
          [10, -20],
          [10, 80],
        ],
        1,
      ),
      b = sectionFrame(
        frame,
        [
          [10, -20],
          [10, 80],
        ],
        -1,
      );
    assert.deepEqual(a.y, [0, 0, 1]);
    assert.deepEqual(b.y, [0, 0, 1]);
    const p = new THREE.Vector3(10, 30, 50);
    assert.equal(p.clone().applyMatrix4(frameMatrix(a)).x, 30);
    assert.equal(p.clone().applyMatrix4(frameMatrix(b)).x, -30);
    assert.equal(parent.id, 'front');
  });
});
test('legacy Single Part section migrates once and preserves annotations and viewport placement', () => {
  const record = {
    sourceId: 'part',
    sheet: { section: 1500, scale: 10, layout: { sectionX: 250, y: 100 } },
    annotations: [
      {
        view: 'section',
        points: [
          [20, 30],
          [50, 60],
        ],
        line: [10, 80],
      },
    ],
  };
  ensurePartViews(record);
  const bounds = { min: { x: 0, y: -100, z: -150 }, max: { x: 3000, y: 100, z: 150 } };
  migratePartSection(record, bounds);
  const section = record.sheet.views.find((v) => v.id === 'section');
  assert.equal(section.section.label, 'A');
  assert.equal(section.source.parentViewId, 'front');
  assert.deepEqual(record.annotations[0].points, [
    [20, 220],
    [50, 250],
  ]);
  const snapshot = structuredClone(record);
  migratePartSection(record, bounds);
  assert.deepEqual(record, snapshot);
  const position = [...section.position];
  syncPartViews(record, record.sheet, [
    [0, 0, 100, 10],
    [0, 20, 100, 30],
  ]);
  assert.deepEqual(record.sheet.views.find((v) => v.id === 'section').position, position);
});
test('cyclic source graph fails explicitly', () => {
  const a = { id: 'a', detail: {}, source: { parentViewId: 'a' } };
  assert.throws(() => modelViewFrame(a, [a], levels));
});

test('section reference visibility uses the finite line, not just its bounding box', () => {
  const { record, section } = setup(),
    next = drawing('2'),
    view = next.sheet.views[0];
  view.size = [20, 20];
  view.scale = 1;
  section.section.points = [
    [-20, 8],
    [8, 20],
  ];
  const refs = referencesInView(drawingDefinitions(record, levels), next, view, levels);
  assert.equal(
    refs.some((r) => r.kind === 'section'),
    false,
  );
});
