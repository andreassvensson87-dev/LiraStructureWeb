import test from 'node:test';
import assert from 'node:assert/strict';
import { numberParts } from '../src/part-marks.js';
import {
  planDrawingNumbering,
  applyDrawingNumbering,
  batchDrawingGroups,
  createBatchDrawings,
} from '../src/single-part-drawings.js';
const beam = (id) => ({
  id,
  profile: 'rect',
  width: 200,
  height: 300,
  thickness: 12,
  rotation: 0,
  start: [0, 0, 0],
  end: [3000, 0, 0],
});
const drawing = (parts, id, num = 'SP-001') => ({
  id: num,
  type: 'SP',
  number: num,
  name: parts.assignments[id].mark,
  mark: parts.assignments[id].mark,
  partKey: parts.assignments[id].key,
  sourceId: id,
  sheet: { scales: { top: 20, front: 10, section: 5 } },
  annotations: [{ sourceId: id, comment: 'Test', points: [[1, 2]] }],
  reviewed: 'old',
});
test('split clones drawing with independent views and annotations; unchanged group keeps original even when its representative changed', () => {
  const objects = ['a', 'b', 'c'].map(beam),
    parts = numberParts(objects),
    old = drawing(parts, 'a'),
    changed = objects.map((o) => (o.id === 'a' ? { ...o, width: 250 } : o)),
    plan = planDrawingNumbering(changed, parts, [old]),
    next = applyDrawingNumbering(plan, {}, () => 'clone');
  assert.equal(next.drawings.length, 2);
  const original = next.drawings.find((d) => d.id === old.id),
    clone = next.drawings.find((d) => d.id === 'clone');
  assert.equal(original.sourceId, 'b');
  assert.equal(original.mark, old.mark);
  assert.equal(clone.sourceId, 'a');
  assert.equal(clone.needsReview, true);
  assert.equal(clone.reviewed, undefined);
  assert.deepEqual(clone.sheet, old.sheet);
  clone.annotations[0].comment = 'New';
  assert.equal(original.annotations[0].comment, 'Test');
  assert.equal(old.annotations[0].comment, 'Test');
  assert.equal(original.annotations[0].sourceId, 'b');
  assert.equal(
    applyDrawingNumbering(planDrawingNumbering(changed, next.parts, next.drawings)).drawings.length,
    2,
  );
});
test('merge requires explicit choice and retains chosen drawing content', () => {
  const objects = [beam('a'), { ...beam('b'), width: 250 }],
    parts = numberParts(objects),
    a = drawing(parts, 'a'),
    b = drawing(parts, 'b', 'SP-002');
  b.annotations[0].comment = 'Keep me';
  const plan = planDrawingNumbering(
      objects.map((o) => ({ ...o, width: 200 })),
      parts,
      [a, b],
    ),
    g = plan.groups[0];
  assert.equal(g.merged, true);
  assert.equal(g.requiresChoice, true);
  assert.throws(() => applyDrawingNumbering(plan), /Välj ritning/);
  const result = applyDrawingNumbering(plan, { [g.key]: b.id });
  assert.equal(result.drawings.length, 1);
  assert.equal(result.drawings[0].id, b.id);
  assert.equal(result.drawings[0].annotations[0].comment, 'Keep me');
  assert.equal(result.drawings[0].mark, parts.assignments.a.mark);
  assert.equal(result.drawings[0].needsReview, true);
  assert.equal(a.annotations[0].comment, 'Test');
});
test('merge lists origins without drawings and automatically retains the sole drawing', () => {
  const objects = [beam('a'), { ...beam('b'), width: 250 }],
    parts = numberParts(objects),
    a = drawing(parts, 'a'),
    plan = planDrawingNumbering(
      objects.map((o) => ({ ...o, width: 200 })),
      parts,
      [a],
    );
  assert.equal(plan.groups[0].origins.filter((o) => !o.drawings.length).length, 1);
  assert.equal(plan.groups[0].requiresChoice, false);
  assert.equal(applyDrawingNumbering(plan).drawings.length, 1);
});
test('batch groups identical parts and prevents duplicate creation on repeated requests', () => {
  const objects = ['a', 'b', 'c'].map(beam),
    parts = numberParts(objects),
    state = { objects, parts, drawings: [], levels: { active: 'l' } },
    selection = new Set(['a', 'b']),
    groups = batchDrawingGroups(state, selection);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].all.length, 3);
  assert.equal(groups[0].objects.length, 2);
  const keys = new Set([groups[0].key]);
  state.drawings = createBatchDrawings(state, selection, keys, () => 'one');
  assert.equal(state.drawings.length, 1);
  assert.equal(createBatchDrawings(state, selection, keys).length, 1);
});
test('invalid or stale numbering cannot create a batch drawing', () => {
  const a = beam('a'),
    parts = numberParts([a]),
    state = { objects: [{ ...a, width: 250 }], parts, drawings: [], levels: { active: 'l' } },
    selection = new Set(['a']),
    group = batchDrawingGroups(state, selection)[0];
  assert.equal(group.valid, false);
  assert.deepEqual(createBatchDrawings(state, selection, new Set([group.key])), []);
});
test('legacy duplicate drawings are resolved by an explicit choice', () => {
  const objects = [beam('a')],
    parts = numberParts(objects),
    a = drawing(parts, 'a'),
    b = drawing(parts, 'a', 'SP-002'),
    plan = planDrawingNumbering(objects, parts, [a, b]);
  assert.equal(plan.groups[0].requiresChoice, true);
  assert.equal(applyDrawingNumbering(plan, { [plan.groups[0].key]: a.id }).drawings.length, 1);
});
test('deleted representative rebinds the drawing to an identical surviving object', () => {
  const objects = [beam('a'), beam('b')],
    parts = numberParts(objects),
    old = drawing(parts, 'a');
  const result = applyDrawingNumbering(planDrawingNumbering([objects[1]], parts, [old]));
  assert.equal(result.drawings[0].id, old.id);
  assert.equal(result.drawings[0].sourceId, 'b');
  assert.equal(result.drawings[0].annotations[0].sourceId, 'b');
  assert.equal(result.drawings[0].needsReview, undefined);
});
test('batch can create several different types in one commit', () => {
  const objects = [beam('a'), { ...beam('b'), width: 250 }, beam('c')],
    parts = numberParts(objects),
    state = { objects, parts, drawings: [], levels: { active: 'l' } },
    selection = new Set(objects.map((o) => o.id));
  const groups = batchDrawingGroups(state, selection);
  let id = 0;
  const result = createBatchDrawings(state, selection, new Set(groups.map((g) => g.key)), () =>
    String(++id),
  );
  assert.equal(result.length, 2);
  assert.equal(new Set(result.map((d) => d.number)).size, 2);
  assert.equal(new Set(result.map((d) => d.partKey)).size, 2);
});
