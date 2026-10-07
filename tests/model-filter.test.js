import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyModelFilter,
  normalizeModelFilter,
  modelFilterRecord,
  matchesModelFilter,
  modelFilterFacets,
} from '../src/model-filter.js';
const levels = {
  items: [
    { id: 'one', name: 'Plan 1', elevation: 0 },
    { id: 'two', name: 'Plan 2', elevation: 3000 },
  ],
};
const beam = (id, material, z = 0) => ({
  id,
  name: `Balk ${id}`,
  prefix: 'B',
  number: Number(id),
  type: 'sweep',
  profile: 'rect',
  width: 100,
  height: 200,
  start: [0, 0, z],
  end: [2000, 0, z],
  material: { name: material },
});
const records = [beam('1', 'S355'), beam('2', 'S235', 3000), beam('3', 'S355', 3000)].map((s) =>
  modelFilterRecord(s, levels),
);
test('model filters use OR within groups and AND between groups and search words', () => {
  const f = emptyModelFilter();
  f.values.material = ['S355', 'S235'];
  f.values.level = ['Plan 2'];
  assert.deepEqual(
    records.filter((r) => matchesModelFilter(r, f)).map((r) => r.id),
    ['2', '3'],
  );
  f.query = 'balk b-003';
  assert.deepEqual(
    records.filter((r) => matchesModelFilter(r, f)).map((r) => r.id),
    ['3'],
  );
  f.values.material = ['S235'];
  assert.equal(records.filter((r) => matchesModelFilter(r, f)).length, 0);
});
test('facet counts consider other groups while retaining selected missing values', () => {
  const f = emptyModelFilter();
  f.values.level = ['Plan 2'];
  f.values.material = ['S355', 'Deleted material'];
  const facets = modelFilterFacets(records, f);
  assert.deepEqual(facets.material, [
    ['Deleted material', 0],
    ['S235', 1],
    ['S355', 1],
  ]);
  assert.deepEqual(facets.level, [
    ['Plan 1', 1],
    ['Plan 2', 1],
  ]);
});
test('view scope intersects filters and is reversible without changing objects', () => {
  const f = emptyModelFilter();
  f.inView = true;
  assert.deepEqual(
    records.filter((r) => matchesModelFilter(r, f, new Set(['2']))).map((r) => r.id),
    ['2'],
  );
  assert.equal(records.filter((r) => matchesModelFilter(r, f)).length, 0);
  f.inView = false;
  assert.equal(records.filter((r) => matchesModelFilter(r, f)).length, 3);
});
test('filter presets normalize safely and survive JSON roundtrip', () => {
  const f = normalizeModelFilter({
    query: 123,
    inView: 'yes',
    values: { material: ['S355', 'S355', null], level: 'all' },
  });
  assert.equal(f.query, '');
  assert.equal(f.inView, false);
  assert.deepEqual(f.values.material, ['S355']);
  assert.deepEqual(f.values.level, []);
  assert.deepEqual(normalizeModelFilter(JSON.parse(JSON.stringify(f))), f);
});
test('records reuse actual object types and map lower insertion point to nearest level', () => {
  const s = beam('4', 'C24', 3100);
  s.end[2] = 0;
  const r = modelFilterRecord(s, levels);
  assert.equal(r.type, 'Sweep');
  assert.equal(r.level, 'Plan 1');
  assert.match(r.profile, /100 × 200/);
  assert.equal(
    modelFilterRecord({ id: 'p', type: 'helperpoint', start: [1, 2, 3000] }, levels).level,
    'Plan 2',
  );
  assert.equal(modelFilterRecord(s, { items: [] }).level, 'Utan nivå');
});
