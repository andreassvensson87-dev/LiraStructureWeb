import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../src/project/project-state.js';
import { createAssembly } from '../src/project/assemblies.js';
import { ProjectHistory } from '../src/project/project-history.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
import { planNumbering, applyNumbering, defaultNumberingSettings } from '../src/numbering/plan.js';
import { planMarkChange, applyMarkChange } from '../src/numbering/mark-change.js';
import { partStatus } from '../src/part-marks.js';
import { assemblyNumberStatus, resolveAssemblyDrawing } from '../src/assembly-numbering.js';
import { drawingCreationGroups, createSelectedDrawings } from '../src/drawing-creation.js';
import { normalizePreset } from '../src/drawing-presets.js';
import { pdfFileName } from '../src/drawing-pdf.js';
const beam = (id, width = 100) => ({
  id,
  type: 'sweep',
  name: 'Balk',
  prefix: 'B',
  number: Number(id.slice(1)),
  profile: 'rect',
  width,
  height: 200,
  thickness: 0,
  rotation: 0,
  start: [0, Number(id.slice(1)) * 1000, 0],
  end: [3000, Number(id.slice(1)) * 1000, 0],
  partSeries: { prefix: 'P', start: 100 },
  assemblySeries: { prefix: 'A', start: 200 },
});
function fixture(objects = [beam('b1')], pairs = false) {
  const p = createProject({
    grid: { x: [], y: [] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  p.objects = objects;
  if (pairs)
    p.assemblies = [
      createAssembly(p, ['b1', 'b2'], 'b1', 'Par 1', () => 'a1'),
      createAssembly(p, ['b3', 'b4'], 'b3', 'Par 2', () => 'a2'),
    ];
  number(p);
  const ids = new Set(objects.map((o) => o.id));
  let serial = 0;
  p.drawings = createSelectedDrawings(
    p,
    ids,
    new Set(drawingCreationGroups(p, ids).map((g) => g.key)),
    normalizePreset({}),
    null,
    () => `drawing-${++serial}`,
  );
  for (const d of p.drawings) {
    d.annotations = [{ id: 'note', sourceId: d.sourceId, comment: 'Behåll', points: [[1, 2]] }];
    d.sheet = { views: [{ id: 'front', name: 'Front', scale: 10 }] };
    d.revision = 'B';
    d.reviewed = 'approved';
  }
  return p;
}
let copy = 0;
function number(p, options = {}, choices = { part: {}, assembly: {} }) {
  const before = structuredClone(p),
    plan = planNumbering(p, { ...defaultNumberingSettings(), ...options });
  assert.deepEqual(p, before, 'preview does not mutate the project');
  Object.assign(
    p,
    applyNumbering(plan, p, choices, () => `copy-${++copy}`),
  );
  for (const o of p.objects.filter((o) => o.type === 'sweep'))
    assert.ok(partStatus(o, p.objects, p.parts).valid);
  assert.ok(p.assemblies.every((a) => assemblyNumberStatus(a, p).valid));
  assert.equal(new Set(p.parts.registry.map((r) => r.mark)).size, p.parts.registry.length);
  assert.equal(
    new Set(p.assemblyNumbering.registry.map((r) => r.mark)).size,
    p.assemblyNumbering.registry.length,
  );
  return plan;
}
const marks = (p) => [
  p.parts.assignments.b1.mark,
  p.assemblies.find((a) => a.mainId === 'b1').mark,
];
const modify = {
  length(p, id) {
    const o = p.objects.find((o) => o.id === id);
    o.end[0] += 500;
  },
  cut(p, id) {
    const o = p.objects.find((o) => o.id === id);
    p.objects.push({
      id: `cut-${id}`,
      type: 'polygoncut',
      prefix: 'C',
      number: 1,
      name: 'Cut',
      targets: [id],
      frame: { origin: [500, o.start[1], 0], u: [1, 0, 0], v: [0, 1, 0] },
      polygon: [
        [0, 0],
        [100, 0],
        [100, 100],
      ],
      thickness: 1000,
      side: 'center',
    });
  },
  hole(p, id) {
    const o = p.objects.find((o) => o.id === id);
    p.objects.push({
      id: `hole-${id}`,
      type: 'fastener',
      name: 'M12',
      prefix: 'S',
      number: Number(id.slice(1)),
      spec: {
        id: 'm12',
        revision: 1,
        kind: 'bolt',
        name: 'M12',
        diameter: 12,
        length: 220,
        head: { kind: 'hex', diameter: 18, height: 7.5 },
        nut: { acrossFlats: 18, thickness: 10 },
      },
      start: [500, o.start[1], 110],
      end: [500, o.start[1], -110],
      nutOffset: 200,
      holes: [{ targetId: id, kind: 'clearance', offset: 10, diameter: 14, depth: 200 }],
    });
  },
};
for (const [label, change] of Object.entries(modify)) {
  test(`single sweep ${label} retains part/assembly marks, drawings and history while requiring review`, () => {
    let p = fixture();
    const originals = structuredClone(p.drawings),
      oldMarks = marks(p);
    change(p, 'b1');
    const changed = structuredClone(p),
      h = new ProjectHistory();
    h.prime(p);
    const plan = planNumbering(p);
    assert.deepEqual(p, changed);
    h.checkpoint(p);
    Object.assign(p, applyNumbering(plan, p));
    assert.deepEqual(marks(p), oldMarks);
    for (const d of p.drawings) {
      const old = originals.find((r) => r.id === d.id);
      assert.ok(old);
      assert.deepEqual(d.annotations, old.annotations);
      assert.equal(d.sheet.views[0].scale, 10);
      assert.equal(d.revision, 'B');
      assert.equal(d.needsReview, true);
      assert.equal(d.reviewed, undefined);
      assert.equal(d.number, old.number);
      assert.equal(d.name, d.mark);
      assert.equal(pdfFileName([d]), `${d.mark}.pdf`);
    }
    p = parseProjectFile(serializeProject(p));
    assert.ok(p.drawings.filter((d) => d.type === 'AS').every((d) => resolveAssemblyDrawing(d, p)));
    const numbered = structuredClone(p);
    number(p);
    assert.deepEqual(JSON.parse(JSON.stringify(p)), JSON.parse(JSON.stringify(numbered)));
    const undone = h.undo(p);
    assert.deepEqual(undone, changed);
    assert.deepEqual(
      JSON.parse(JSON.stringify(h.redo(undone))),
      JSON.parse(JSON.stringify(numbered)),
    );
  });
  test(`${label} on all identical occurrences retains both marks; a partial edit preserves unchanged owners in either model order`, () => {
    const all = fixture([beam('b1'), beam('b2')]),
      old = marks(all),
      drawingIds = all.drawings.map((d) => d.id).sort();
    change(all, 'b1');
    change(all, 'b2');
    number(all);
    assert.deepEqual(marks(all), old);
    assert.equal(all.parts.assignments.b2.mark, old[0]);
    assert.deepEqual(all.drawings.map((d) => d.id).sort(), drawingIds);
    for (const reverse of [false, true]) {
      const split = fixture([beam('b1'), beam('b2')]);
      change(split, 'b1');
      if (reverse) split.objects.reverse();
      number(split);
      assert.equal(split.parts.assignments.b2.mark, old[0]);
      assert.notEqual(split.parts.assignments.b1.mark, old[0]);
      assert.equal(split.assemblies.find((a) => a.mainId === 'b2').mark, old[1]);
      assert.notEqual(split.assemblies.find((a) => a.mainId === 'b1').mark, old[1]);
      for (const mark of old)
        assert.ok(
          split.drawings.some(
            (d) => d.id === drawingIds.find((id) => id === d.id) && d.mark === mark,
          ),
        );
    }
  });
}
test('all occurrences split into different new types: majority retains original marks and original drawings, independent of order', () => {
  for (const reverse of [false, true]) {
    const p = fixture([beam('b1'), beam('b2'), beam('b3')]),
      old = marks(p),
      ids = p.drawings.map((d) => d.id);
    p.objects[0].width = 120;
    p.objects[1].width = p.objects[2].width = 140;
    if (reverse) p.objects.reverse();
    number(p);
    assert.equal(p.parts.assignments.b2.mark, old[0]);
    assert.equal(p.parts.assignments.b3.mark, old[0]);
    for (const id of ids)
      assert.ok(['b2', 'b3'].includes(p.drawings.find((d) => d.id === id).sourceId));
    assert.equal(p.assemblies.find((a) => a.mainId === 'b2').mark, old[1]);
  }
});
test('joining an existing type uses its mark and requires explicit drawing choices before a transactional merge', () => {
  const p = fixture([beam('b1'), beam('b2', 120)]);
  const targetPart = p.parts.assignments.b2.mark,
    targetAssembly = p.assemblies.find((a) => a.mainId === 'b2').mark;
  p.objects[0].width = 120;
  const before = structuredClone(p),
    plan = planNumbering(p);
  assert.equal(plan.conflicts.length, 2);
  assert.throws(() => applyNumbering(plan, p), /Välj/);
  assert.deepEqual(p, before);
  const choices = { part: {}, assembly: {} };
  for (const g of plan.conflicts)
    choices[g.kind][g.key] = g.candidates.find((d) => d.sourceId === 'b1').id;
  const chosen = p.drawings.filter((d) => d.sourceId === 'b1').map((d) => d.id);
  number(p, {}, choices);
  assert.deepEqual(marks(p), [targetPart, targetAssembly]);
  assert.deepEqual(p.drawings.map((d) => d.id).sort(), chosen.sort());
});
test('series changes, explicit new-number policy and full renumber remain deliberate exceptions', () => {
  const p = fixture();
  modify.cut(p, 'b1');
  number(p, { modifiedParts: 'new' });
  assert.notEqual(p.parts.assignments.b1.mark, 'P100');
  const series = fixture();
  series.objects[0].partSeries.start = 500;
  series.objects[0].assemblySeries.start = 600;
  number(series);
  assert.deepEqual(marks(series), ['P500', 'A600']);
  const full = fixture();
  modify.cut(full, 'b1');
  number(full, { renumberAll: true });
  assert.deepEqual(marks(full), ['P100', 'A200']);
});
test('manual marks follow a changed sole owner, but an unchanged owner wins a split', () => {
  const p = fixture();
  for (const [kind, id, mark] of [
    ['part', 'b1', 'P150'],
    ['assembly', p.assemblies[0].id, 'A250'],
  ])
    Object.assign(p, applyMarkChange(planMarkChange(p, { kind, id }, mark), p));
  modify.length(p, 'b1');
  number(p);
  assert.deepEqual(marks(p), ['P150', 'A250']);
  assert.ok(p.parts.registry.find((r) => r.mark === 'P150').manual);
  assert.ok(p.assemblyNumbering.registry.find((r) => r.mark === 'A250').manual);
});
test('deleting an owner does not transfer its mark to unrelated new geometry', () => {
  const p = fixture();
  p.objects = [beam('b2', 120)];
  p.assemblies = [];
  number(p);
  assert.notEqual(p.parts.assignments.b2.mark, 'P100');
});

test('relative changes within multi-part assemblies retain the type only when all old instances change together', () => {
  for (const all of [false, true]) {
    const p = fixture([beam('b1'), beam('b2', 120), beam('b3'), beam('b4', 120)], true);
    const before = structuredClone(p),
      mark = p.assemblies[0].mark,
      draw = p.drawings.find((d) => d.type === 'AS');
    for (const id of all ? ['b2', 'b4'] : ['b2']) {
      const o = p.objects.find((o) => o.id === id);
      o.start[1] += 100;
      o.end[1] += 100;
    }
    number(p);
    assert.deepEqual(p.parts.assignments, before.parts.assignments);
    if (all) {
      assert.ok(p.assemblies.every((a) => a.mark === mark));
      assert.equal(p.drawings.filter((d) => d.type === 'AS').length, 1);
      assert.equal(p.drawings.find((d) => d.id === draw.id).mark, mark);
      assert.equal(p.drawings.find((d) => d.id === draw.id).needsReview, true);
    } else {
      assert.equal(p.assemblies.find((a) => a.id === 'a2').mark, mark);
      assert.notEqual(p.assemblies.find((a) => a.id === 'a1').mark, mark);
    }
  }
});
test('remove cut and recreate old geometry keeps the changed owner stable without assigning its mark to the new object', () => {
  const p = fixture();
  modify.cut(p, 'b1');
  number(p);
  p.objects.push(beam('b2'));
  number(p);
  assert.equal(p.parts.assignments.b1.mark, 'P100');
  assert.notEqual(p.parts.assignments.b2.mark, 'P100');
  p.objects = p.objects.filter((o) => o.id !== 'cut-b1');
  const plan = planNumbering(p),
    choices = { part: {}, assembly: {} };
  for (const conflict of plan.conflicts)
    choices[conflict.kind][conflict.key] = conflict.candidates.find((d) => d.sourceId === 'b1').id;
  number(p, {}, choices);
  assert.equal(p.parts.assignments.b1.mark, p.parts.assignments.b2.mark);
});

test('simultaneous split/merge preserves both available former marks rather than allocating a needless third', () => {
  for (const reverse of [false, true]) {
    const p = fixture([beam('b1'), beam('b2', 120), beam('b3')]);
    p.drawings = []; // This case isolates mark ownership; drawing merge choices have separate coverage.
    const old1 = p.parts.assignments.b1.mark,
      old2 = p.parts.assignments.b2.mark;
    p.objects[0].width = p.objects[1].width = 140;
    p.objects[2].width = 160;
    if (reverse) p.objects.reverse();
    number(p);
    assert.equal(p.parts.assignments.b1.mark, old2);
    assert.equal(p.parts.assignments.b2.mark, old2);
    assert.equal(p.parts.assignments.b3.mark, old1);
    assert.equal(new Set(p.assemblies.map((a) => a.mark)).size, 2);
  }
});
