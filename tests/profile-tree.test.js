import test from 'node:test';
import assert from 'node:assert/strict';
import { libraryTree } from '../src/profile-tree.js';
const profiles = [
  { id: 'a', revision: 1, name: 'HEA200', family: 'HEA', profileType: 'h' },
  { id: 'a', revision: 2, name: 'HEA200', family: 'HEA', profileType: 'h' },
  { id: 'b', revision: 1, name: 'HEA100', family: 'HEA', profileType: 'h' },
  { id: 'c', revision: 1, name: 'C100', family: 'HEA', profileType: 'c' },
  { id: 'legacy', revision: 1, name: 'Äldre' },
];
test('groups types, families and naturally sorted sizes; versions stay under one size', () => {
  const tree = libraryTree(profiles),
    h = tree.find((t) => t.type === 'h');
  assert.equal(h.families.length, 1);
  assert.deepEqual(
    h.families[0].sizes.map((s) => s.latest.name),
    ['HEA100', 'HEA200'],
  );
  assert.deepEqual(
    h.families[0].sizes[1].versions.map((s) => s.revision),
    [2, 1],
  );
  assert.equal(tree.find((t) => t.type === 'c').families[0].sizes.length, 1);
  assert.equal(tree.find((t) => t.type === 'custom').families[0].name, 'Utan familj');
});
test('search retains matching ancestors and uses latest classification without mutating records', () => {
  const before = structuredClone(profiles);
  assert.equal(libraryTree(profiles, 'hea200')[0].families[0].sizes.length, 1);
  assert.equal(libraryTree(profiles, 'missing').length, 0);
  assert.deepEqual(profiles, before);
  const moved = [...profiles, { ...profiles[1], revision: 3, family: 'Egen serie' }];
  assert.equal(libraryTree(moved, 'egen serie')[0].families[0].sizes[0].versions.length, 3);
});
