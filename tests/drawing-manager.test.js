import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../src/project/project-state.js';
import {
  drawingStamp,
  drawingStatus,
  drawingManagerRows,
  duplicateDrawings,
  drawingScale,
} from '../src/drawing-manager.js';
function fixture() {
  const state = createProject({
    grid: { x: [0, 1000], y: [0, 1000] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  state.drawings = [
    { id: 'one', type: 'GA', number: 'GA-2', name: 'Plan A', levelId: 'l', revision: 'B' },
    { id: 'two', type: 'GA', number: 'GA-10', name: 'Plan B', levelId: 'l' },
    { id: 'three', type: 'GA', number: 'GA-1', name: 'Sektion', levelId: 'missing' },
  ];
  return state;
}
test('manager status reflects model changes, explicit review and missing sources', () => {
  const state = fixture(),
    record = state.drawings[0];
  assert.equal(drawingStatus(record, state).key, 'new');
  record.reviewed = drawingStamp(record, state);
  assert.equal(drawingStatus(record, state).key, 'current');
  state.grid.x.push(2000);
  assert.equal(drawingStatus(record, state).key, 'changed');
  assert.equal(drawingStatus(state.drawings[2], state).key, 'missing');
});
test('manager filters combine status and search and sort drawing numbers naturally', () => {
  const state = fixture();
  assert.deepEqual(
    drawingManagerRows(state).map((r) => r.record.id),
    ['three', 'one', 'two'],
  );
  assert.deepEqual(
    drawingManagerRows(state, { query: 'plan', descending: true }).map((r) => r.record.id),
    ['two', 'one'],
  );
  assert.deepEqual(
    drawingManagerRows(state, { filter: 'update' }).map((r) => r.record.id),
    ['three'],
  );
  assert.equal(drawingManagerRows(state, { filter: 'SP' }).length, 0);
  assert.equal(drawingManagerRows(state, { query: 'B', sort: 'drawing.revision' }).length, 2);
});
test('drawing copies retain sources, detach nested edits and get unique numbers without review stamps', () => {
  const state = fixture();
  state.drawings[0].sheet = { views: [{ id: 'v', scale: 20 }] };
  state.drawings[0].reviewed = 'old';
  state.drawings.push({ ...state.drawings[0], id: 'copy', number: 'GA-2-K1' });
  const next = duplicateDrawings(state.drawings, new Set(['one']), () => 'new');
  const copy = next.at(-1);
  assert.equal(copy.number, 'GA-2-K2');
  assert.equal(copy.levelId, 'l');
  assert.equal(copy.reviewed, null);
  copy.sheet.views[0].scale = 50;
  assert.equal(state.drawings[0].sheet.views[0].scale, 20);
  assert.throws(() => duplicateDrawings([{ id: 'a', type: 'AS' }], new Set(['a'])), /Assembly/);
});
test('scale column shows all distinct view scales and leaves unconfigured scales blank', () => {
  assert.equal(
    drawingScale({ sheet: { views: [{ scale: 20 }, { scale: 10 }, { scale: 20 }] } }),
    '1:20, 1:10',
  );
  assert.equal(drawingScale({ sheet: { viewScale: 50 } }), '1:50');
  assert.equal(drawingScale({}), '—');
  assert.equal(drawingScale({ sheet: { viewScale: 45.66787003610108 } }), '1:45,67');
});
