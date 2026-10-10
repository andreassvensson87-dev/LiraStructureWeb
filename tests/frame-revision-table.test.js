import test from 'node:test';
import assert from 'node:assert/strict';
import { revisionExampleBlock } from './fixtures/frame-blocks.js';
import { expandRevisionBlock } from '../src/frame-revision-table.js';
import { expandLayout } from '../src/frame-layout.js';
import { updateDrawingAttribute, builtInAttributes } from '../src/drawing-attributes.js';
const revision = (label) => ({
  revision: label,
  revisionDate: '2026-10-06',
  revisionCreatedBy: 'AS',
  revisionComment: 'Ändring ' + label,
});
test('revision-only block grows upwards, newest row above earlier rows and header fixed at the bottom', () => {
  const block = revisionExampleBlock();
  assert.equal(block.height, 20);
  assert.ok(
    block.entities.filter((e) => e.type === 'attribute').every((e) => e.key.includes('revision')),
  );
  const drawing = { ...revision('C'), revisions: ['A', 'B', 'C'].map(revision) };
  const expanded = expandRevisionBlock(block, drawing);
  const rows = expanded.filter((e) => ['A', 'B', 'C'].includes(e.text));
  assert.deepEqual(
    rows.map((e) => [e.text, e.point[1]]),
    [
      ['A', 13],
      ['B', 23],
      ['C', 33],
    ],
  );
  assert.equal(expanded.find((e) => e.text === 'REV.').point[1], 4);
  assert.equal(
    Math.max(...expanded.filter((e) => e.points).flatMap((e) => e.points.map((p) => p[1]))),
    40,
  );
  const layout = {
    width: 420,
    height: 297,
    entities: [{ id: 'i', blockId: block.id, anchor: 'bottom-right', point: [-180, 80] }],
  };
  const placed = expandLayout(layout, [block], drawing);
  assert.equal(placed.find((e) => e.text === 'A').point[1], 93);
  assert.equal(placed.find((e) => e.text === 'C').point[1], 113);
  assert.equal(block.entities.find((e) => e.text === 'REV.').point[1], 4);
});
test('empty revision list renders only column headings and legacy drawings retain their revision', () => {
  const block = revisionExampleBlock();
  assert.equal(expandRevisionBlock(block, {}).filter((e) => e.type === 'attribute').length, 0);
  assert.equal(expandRevisionBlock(block, revision('1')).find((e) => e.text === '1').point[1], 13);
});
test('editing a current revision attribute updates the matching history row without altering older values', () => {
  const record = { id: 'a', type: 'GA', ...revision('B'), revisions: ['A', 'B'].map(revision) };
  const attribute = builtInAttributes.find((a) => a.key === 'drawing.revisionComment');
  const next = updateDrawingAttribute([record], 'a', attribute, 'Korrigering')[0];
  assert.equal(next.revisions[0].revisionComment, 'Ändring A');
  assert.equal(next.revisions[1].revisionComment, 'Korrigering');
  assert.equal(record.revisions[1].revisionComment, 'Ändring B');
});

test('earlier revision blocks migrate their header down without moving the insertion point', () => {
  const block = revisionExampleBlock();
  delete block.revisionTable.headerPosition;
  for (const e of block.entities) {
    const delta = e.revisionRole === 'row' ? -10 : 10;
    if (e.points) e.points = e.points.map(([x, y]) => [x, y + delta]);
    else e.point[1] += delta;
  }
  const expanded = expandRevisionBlock(block, {
    ...revision('B'),
    revisions: ['A', 'B'].map(revision),
  });
  assert.equal(expanded.find((e) => e.text === 'REV.').point[1], 4);
  assert.equal(expanded.find((e) => e.text === 'B').point[1], 23);
  assert.deepEqual(block.origin, [0, 0]);
  assert.equal(block.entities.find((e) => e.text === 'REV.').point[1], 14);
});
