import test from 'node:test';
import assert from 'node:assert/strict';
import { libraryTree, libraryGroups } from '../src/profile-tree.js';
import { TIBNOR_PROFILES } from '../src/tibnor-catalog.js';
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
test('compact hierarchy combines beam types into groups, families and profile sizes', () => {
  const groups = libraryGroups(TIBNOR_PROFILES);
  assert.equal(groups.length, 3);
  assert.equal(groups[0].label, 'Balkar');
  assert.deepEqual(
    groups[0].families.map((f) => [f.label, f.sizes.length]),
    [
      ['HEA', 24],
      ['HEB', 24],
      ['HEM', 24],
      ['IPE', 18],
      ['U/UPN', 23],
      ['UPE', 14],
    ],
  );
  assert.equal(groups[1].label, 'Hålprofiler');
  assert.deepEqual(
    groups[1].families.map((f) => [f.label, f.sizes.length]),
    [
      ['KKR kvadratisk', 58],
      ['KKR rektangulär', 64],
      ['Runda svetsade', 38],
      ['Runda sömlösa', 353],
      ['VKR kvadratisk', 65],
      ['VKR rektangulär', 77],
    ],
  );
  assert.equal(groups[2].label, 'Stänger');
  assert.deepEqual(
    groups[2].families.map((f) => [f.label, f.sizes.length]),
    [
      ['L liksidig', 59],
      ['L oliksidig', 49],
      ['T', 11],
    ],
  );
  assert.equal(
    libraryGroups(TIBNOR_PROFILES, ' hea200 ')[0].families[0].sizes[0].latest.name,
    'HEA 200',
  );
  assert.equal(libraryGroups(TIBNOR_PROFILES, 'HEA')[0].families.length, 1);
  assert.equal(libraryGroups(TIBNOR_PROFILES, 'saknas').length, 0);
});
