import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDrawingRevision, revisionValues } from '../src/drawing-revisions.js';
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
