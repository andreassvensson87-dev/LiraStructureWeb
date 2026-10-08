import test from 'node:test';
import assert from 'node:assert/strict';
import { numberParts } from '../src/part-marks.js';
import { createProject } from '../src/project/project-state.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
import {
  normalizeSinglePartMaterialSchedule,
  singlePartMaterialPosition,
  singlePartMaterialData,
  appendSinglePartMaterialSchedule,
} from '../src/single-part-material-schedule.js';
const beam = (id, y, length = 609) => ({
  id,
  type: 'sweep',
  profile: 'rect',
  width: 100,
  height: 100,
  thickness: 0,
  rotation: 0,
  start: [0, y, 0],
  end: [length, y, 0],
  material: { name: 'S355J2H', density: 7850 },
});
function fixture() {
  const objects = [beam('a', 0), beam('b', 300), beam('c', 600), beam('other', 900, 800)];
  const parts = numberParts(objects);
  const record = {
    id: 'drawing',
    number: 'SP-001',
    name: 'Detalj',
    type: 'SP',
    sourceId: 'a',
    partKey: parts.assignments.a.key,
    mark: parts.assignments.a.mark,
  };
  return { objects, parts, record };
}
test('single part list counts current identical parts and calculates totals before rounding', () => {
  const state = fixture(),
    data = singlePartMaterialData(state.record, state);
  assert.equal(data.quantity, 3);
  assert.equal(data.verified, true);
  assert.equal(data.length, 609);
  assert.equal(data.totalLength, 1827);
  assert.ok(Math.abs(data.unitWeight - 47.8065) < 1e-9);
  assert.ok(Math.abs(data.totalWeight - 143.4195) < 1e-9);
  state.objects.pop();
  state.objects.pop();
  assert.equal(singlePartMaterialData(state.record, state).quantity, 2);
  state.objects[1].end[0] = 700;
  assert.equal(singlePartMaterialData(state.record, state).quantity, 1);
});
test('missing density stays unknown; stale source hides quantity and totals in vector output', () => {
  const state = fixture();
  state.objects[0].end[0] = 900;
  assert.equal(singlePartMaterialData(state.record, state).verified, false);
  delete state.objects[0].material;
  const data = singlePartMaterialData(state.record, state);
  assert.equal(data.unitWeight, null);
  assert.equal(data.totalWeight, null);
});
test('single part list docks at top right and placement options round-trip with drawing', () => {
  assert.deepEqual(
    singlePartMaterialPosition([420, 297], { contentArea: [20, 10, 410, 235] }),
    [319, 10],
  );
  assert.deepEqual(
    singlePartMaterialPosition([210, 297], { contentArea: [20, 10, 200, 235] }),
    [109, 10],
  );
  const source = { position: [30, 40], dockToTop: false, visible: false },
    draft = normalizeSinglePartMaterialSchedule(source);
  draft.position[0] = 100;
  assert.equal(source.position[0], 30);
  const state = createProject({
    grid: { x: [0, 1000], y: [0, 1000] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  const model = fixture();
  state.objects = model.objects;
  state.parts = model.parts;
  state.drawings = [{ ...model.record, sheet: { partMaterialSchedule: draft } }];
  const loaded = parseProjectFile(serializeProject(state));
  assert.deepEqual(loaded.drawings[0].sheet.partMaterialSchedule, draft);
});
test('single part vector list has five columns with only length and weight totals beneath', () => {
  const element = (tag) => ({
    tag,
    attrs: {},
    children: [],
    setAttribute(k, v) {
      this.attrs[k] = v;
    },
    append(...items) {
      this.children.push(...items);
    },
  });
  const previous = globalThis.document;
  globalThis.document = { createElementNS: (_, tag) => element(tag) };
  try {
    const state = fixture(),
      svg = element('svg');
    const g = appendSinglePartMaterialSchedule(
      svg,
      singlePartMaterialData(state.record, state),
      normalizeSinglePartMaterialSchedule(),
    );
    assert.equal(g.children.filter((e) => e.tag === 'rect').length, 7);
    const texts = g.children.filter((e) => e.tag === 'text').map((e) => e.textContent);
    for (const value of [
      'ANTAL',
      'PROFIL',
      'KVALITET',
      'LÄNGD [mm]',
      'VIKT [kg]',
      'LÄNGD TOT.',
      'VIKT TOT.',
      '3',
      '609',
      '1827',
      '47,8',
      '143,4',
    ])
      assert.ok(texts.includes(value), value);
    assert.equal(appendSinglePartMaterialSchedule(svg, {}, { visible: false }), undefined);
    state.objects[0].end[0] = 900;
    const stale = appendSinglePartMaterialSchedule(
      element('svg'),
      singlePartMaterialData(state.record, state),
      normalizeSinglePartMaterialSchedule(),
    );
    assert.equal(stale.children.filter((e) => e.tag === 'text' && e.textContent === '—').length, 3);
  } finally {
    globalThis.document = previous;
  }
});
