import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDrawingRevision,
  revisionValues,
  editDrawingRevision,
  removeDrawingRevision,
} from '../src/drawing-revisions.js';
import { builtInAttributes, drawingAttributeContext } from '../src/drawing-attributes.js';
import { attributeValue } from '../src/frame-model.js';
import { drawingStamp } from '../src/drawing-manager.js';
import { createProject } from '../src/project/project-state.js';
const values = {
  revision: 'A',
  revisionCreatedBy: 'Anna Åström',
  revisionComment: 'Ändrad balk',
  revisionDate: '2026-10-06',
};
test('revision applies atomically to chosen drawings and preserves numbering and sources', () => {
  const records = [
    { id: 'a', type: 'GA', number: 'GA-001', levelId: 'l' },
    { id: 'b', type: 'SP', sourceId: 'part' },
    { id: 'c', type: 'AS', assemblyId: 'assembly' },
  ];
  const next = applyDrawingRevision(records, new Set(['a', 'c']), values);
  assert.equal(next[0].revision, 'A');
  assert.equal(next[2].revisionCreatedBy, 'Anna Åström');
  assert.equal(next[0].number, 'GA-001');
  assert.equal(next[2].assemblyId, 'assembly');
  assert.equal(next[0].needsReview, true);
  assert.equal(next[1], records[1]);
  assert.equal(records[0].revision, undefined);
  assert.throws(() => applyDrawingRevision(records, new Set(['a', 'missing']), values));
});
test('letter and numeric revision labels are supported and invalid dates cannot be saved', () => {
  assert.equal(revisionValues({ ...values, revision: ' 1 ' }).revision, '1');
  for (const date of ['2026-02-31', '2026-13-01', 'abc', ''])
    assert.throws(() => revisionValues({ ...values, revisionDate: date }));
  assert.throws(() => revisionValues({ ...values, revision: '' }));
  assert.throws(() => revisionValues({ ...values, revisionCreatedBy: '' }));
});
test('revision fields are shared drawing attributes available to all types and title blocks', () => {
  for (const type of ['GA', 'SP', 'AS']) {
    const context = drawingAttributeContext({ type, ...values });
    for (const [field, value] of Object.entries(values)) {
      const key = 'drawing.' + field;
      assert.equal(builtInAttributes.find((a) => a.key === key).scope, 'all');
      assert.equal(attributeValue(key, context), value);
    }
  }
});
test('changes to every revision attribute invalidate the reviewed drawing stamp', () => {
  const state = createProject({
    grid: { x: [0, 1000], y: [0, 1000] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  const record = { id: 'a', type: 'GA', levelId: 'l', ...values };
  const stamp = drawingStamp(record, state);
  for (const key of Object.keys(values))
    assert.notEqual(drawingStamp({ ...record, [key]: 'changed' }, state), stamp);
});

test('new revisions preserve earlier values, migrate the current revision and update latest in place', () => {
  const initial = { id: 'a', ...values };
  const b = { ...values, revision: 'B', revisionComment: 'Ny koppling' };
  const records = applyDrawingRevision([initial], new Set(['a']), b);
  assert.deepEqual(
    records[0].revisions.map((r) => r.revision),
    ['A', 'B'],
  );
  assert.equal(records[0].revisions[0].revisionComment, values.revisionComment);
  assert.equal(initial.revisions, undefined);
  const edited = applyDrawingRevision(records, new Set(['a']), {
    ...b,
    revisionComment: 'Korrigerad kommentar',
  });
  assert.equal(edited[0].revisions.length, 2);
  assert.equal(records[0].revisions[1].revisionComment, 'Ny koppling');
  assert.throws(() => applyDrawingRevision(edited, new Set(['a']), values), /redan/);
  assert.deepEqual(JSON.parse(JSON.stringify(edited)), edited);
});

test('editing an older revision preserves chronology and current drawing attributes', () => {
  const a = { ...values, revision: 'A' },
    b = { ...values, revision: 'B' };
  const records = applyDrawingRevision(
    applyDrawingRevision([{ id: 'a' }, { id: 'other' }], new Set(['a']), a),
    new Set(['a']),
    b,
  );
  const edited = editDrawingRevision(records, 'a', 'A', {
    ...a,
    revision: '1',
    revisionComment: 'Korrigerad',
  });
  assert.deepEqual(
    edited[0].revisions.map((r) => r.revision),
    ['1', 'B'],
  );
  assert.equal(edited[0].revision, 'B');
  assert.equal(edited[0].revisionComment, b.revisionComment);
  assert.equal(edited[1], records[1]);
  assert.equal(records[0].revisions[0].revision, 'A');
  assert.throws(() => editDrawingRevision(records, 'a', 'A', b), /redan/);
  assert.throws(() => editDrawingRevision(records, 'a', 'missing', a), /längre/);
});
test('removing the latest revision promotes previous values and removing all clears live attributes', () => {
  const a = { ...values, revision: 'A', revisionCreatedBy: 'Anna' },
    b = { ...values, revision: 'B', revisionCreatedBy: 'Bertil' };
  const record = applyDrawingRevision(
    applyDrawingRevision([{ id: 'a', number: 'GA-1' }], new Set(['a']), a),
    new Set(['a']),
    b,
  );
  const next = removeDrawingRevision(record, 'a', 'B');
  assert.equal(next[0].revision, 'A');
  assert.equal(next[0].revisionCreatedBy, 'Anna');
  assert.equal(next[0].revisions.length, 1);
  assert.equal(record[0].revisions.length, 2);
  const empty = removeDrawingRevision(next, 'a', 'A');
  for (const field of Object.keys(values)) assert.equal(empty[0][field], '');
  assert.deepEqual(empty[0].revisions, []);
  assert.equal(empty[0].number, 'GA-1');
  assert.equal(empty[0].needsReview, true);
  assert.throws(() => removeDrawingRevision(next, 'a', 'missing'), /längre/);
});
test('latest editing and deletion of an older or legacy revision keep revision rows consistent', () => {
  const legacy = { id: 'a', ...values };
  const edited = editDrawingRevision([legacy], 'a', 'A', {
    ...values,
    revision: '1',
    revisionComment: 'Ny kommentar',
  });
  assert.equal(edited[0].revision, '1');
  assert.equal(edited[0].revisionComment, 'Ny kommentar');
  const newer = applyDrawingRevision(edited, new Set(['a']), { ...values, revision: '2' });
  const removed = removeDrawingRevision(newer, 'a', '1');
  assert.equal(removed[0].revision, '2');
  assert.deepEqual(
    removed[0].revisions.map((r) => r.revision),
    ['2'],
  );
  assert.deepEqual(removeDrawingRevision([legacy], 'a', 'A')[0].revisions, []);
});
