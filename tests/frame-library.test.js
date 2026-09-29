import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyLibraryItem, libraryUsage } from '../src/frame-library.js';
test('copies isolate geometry and IDs, while layout references keep their blocks', () => {
  const original = {
    id: 'layout',
    name: 'A3',
    entities: [{ id: 'instance', blockId: 'title', point: [1, 2] }],
  };
  const copy = copyLibraryItem(original, [original, { name: 'A3 – kopia' }]);
  assert.equal(copy.name, 'A3 – kopia 2');
  assert.notEqual(copy.id, original.id);
  assert.notEqual(copy.entities[0].id, 'instance');
  assert.equal(copy.entities[0].blockId, 'title');
  copy.entities[0].point[0] = 100;
  assert.equal(original.entities[0].point[0], 1);
});
test('usage detects block dependencies and both drawing types', () => {
  const layouts = [
    { name: 'A3', entities: [{ blockId: 'title' }] },
    { name: 'A4', entities: [] },
  ];
  const drawings = [
    { number: 'GA1', name: 'Plan', sheet: { layoutId: 'a3' } },
    { number: 'P1', name: 'Part', sheet: { layoutId: 'a3' } },
    { name: 'No layout' },
  ];
  assert.deepEqual(libraryUsage('title', 'ramblock', layouts, drawings), ['A3']);
  assert.deepEqual(libraryUsage('a3', 'layout', layouts, drawings), ['GA1 · Plan', 'P1 · Part']);
  assert.deepEqual(libraryUsage('unused', 'layout', layouts, drawings), []);
});
