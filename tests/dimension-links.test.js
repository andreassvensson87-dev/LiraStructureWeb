import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  linkedDimensions,
  moveLinkedDimensions,
  unlinkDimensions,
  linkedPaperOffsets,
} from '../src/dimension-links.js';

const dimensions = () => [
  {
    type: 'dimension',
    view: 'front',
    dimensionLinkId: 'group',
    kind: 'horizontal',
    points: [
      [0, 0],
      [100, 0],
    ],
    line: [120, 20],
    references: [{ source: 'a' }],
  },
  {
    type: 'dimension',
    view: 'front',
    dimensionLinkId: 'group',
    kind: 'vertical',
    points: [
      [100, 0],
      [100, 80],
    ],
    line: [120, 20],
  },
  {
    type: 'dimension',
    view: 'other',
    dimensionLinkId: 'group',
    kind: 'horizontal',
    points: [
      [0, 0],
      [100, 0],
    ],
    line: [120, 20],
  },
];

test('linked movement translates both lines while preserving anchors, references and other views', () => {
  const items = dimensions(),
    before = structuredClone(items);
  moveLinkedDimensions(items, items[0], [140, 35]);
  assert.deepEqual(
    items.slice(0, 2).map((i) => i.line),
    [
      [140, 35],
      [140, 35],
    ],
  );
  assert.deepEqual(items[0].points, before[0].points);
  assert.deepEqual(items[0].references, before[0].references);
  assert.deepEqual(items[2], before[2]);
});
test('breaking a pair releases both chains and subsequent moves affect only the selected chain', () => {
  const items = dimensions();
  unlinkDimensions(items, items[0]);
  assert.equal(items[1].dimensionLinkId, undefined);
  assert.equal(linkedDimensions(items, items[0]).length, 1);
  moveLinkedDimensions(items, items[0], [150, 40]);
  assert.deepEqual(items[1].line, [120, 20]);
});
test('paper distance changes retain each side and use drawing scale without mutating until accepted', () => {
  const items = dimensions();
  items[1].line = [80, 20];
  const before = structuredClone(items),
    project = (p) => p.map((v) => v * 0.08);
  const changes = linkedPaperOffsets(items, items[0], 10, project, 4);
  assert.deepEqual(items, before);
  for (const { member, line } of changes) member.line = line;
  assert.equal(items[0].line[1], 500);
  assert.ok(Math.abs(items[1].line[0] + 400) < 1e-9);
  assert.throws(() => linkedPaperOffsets(items, items[0], NaN, project, 4));
});
