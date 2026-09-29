import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, captureProject } from '../src/project/project-state.js';
import { ProjectHistory } from '../src/project/project-history.js';
import { mergeDrawingEdit } from '../src/project/drawing-edits.js';
const create = () =>
  createProject({
    grid: { x: [0, 1000], y: [0, 1000] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
test('project owns its input and snapshots exclude transient editor state', () => {
  const p = create();
  p.objects.push({ id: 'a', start: [1, 2, 3] });
  p.camera = {};
  p.selection = new Set(['a']);
  const snapshot = captureProject(p);
  p.objects[0].start[0] = 9;
  assert.equal(snapshot.objects[0].start[0], 1);
  assert.equal(snapshot.camera, undefined);
  assert.equal(snapshot.selection, undefined);
  assert.equal(snapshot.schemaVersion, 1);
});
test('undo/redo restores geometry, drawings, numbering and settings as one unit', () => {
  let p = create();
  const h = new ProjectHistory(2);
  h.checkpoint(p);
  p.objects.push({ id: 'a' });
  p.drawings.push({ id: 'd', sourceId: 'a' });
  p.parts.assignments.a = { mark: 'B-1' };
  p.snap.polar = '30';
  p = h.undo(p);
  assert.equal(p.objects.length, 0);
  assert.equal(p.drawings.length, 0);
  assert.equal(p.snap.polar, '45');
  p = h.redo(p);
  assert.equal(p.drawings[0].sourceId, p.objects[0].id);
  assert.equal(p.parts.assignments.a.mark, 'B-1');
  assert.equal(p.snap.polar, '30');
});
test('new edits discard redo, history is bounded and empty undo is harmless', () => {
  const p = create(),
    h = new ProjectHistory(2);
  assert.equal(h.undo(p), null);
  for (let i = 0; i < 3; i++) {
    h.checkpoint(p);
    p.info.name = String(i);
  }
  assert.equal(h.past.length, 2);
  const restored = h.undo(p);
  h.checkpoint(restored);
  assert.equal(h.canRedo, false);
  restored.info.name = 'later';
  assert.notEqual(h.past.at(-1).info.name, 'later');
});
test('drawing edits preserve source identity and do not share mutable editor data', () => {
  const rows = [{ id: 'd', number: 'SP-1', sourceId: 'a', sheet: { views: [] } }],
    edit = { id: 'd', number: 'wrong', sourceId: 'wrong', sheet: { views: [{ id: 'v' }] } };
  const next = mergeDrawingEdit(rows, edit);
  edit.sheet.views[0].id = 'changed';
  assert.equal(next[0].number, 'SP-1');
  assert.equal(next[0].sourceId, 'a');
  assert.equal(next[0].sheet.views[0].id, 'v');
  assert.equal(mergeDrawingEdit(rows, { id: 'missing' }), rows);
  assert.equal(mergeDrawingEdit(rows, rows[0]), rows);
});
