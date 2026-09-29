import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MATERIAL_TYPES,
  validateMaterialLibrary,
  mergeMaterials,
  latestMaterials,
  objectColor,
} from '../src/materials.js';
const m = {
  id: 'test',
  revision: 1,
  category: 'steel',
  name: 'Testmaterial',
  density: 1234,
  color: '#8899aa',
};
test('material categories, validated JSON roundtrip and immutable copies', () => {
  assert.equal(MATERIAL_TYPES.length, 5);
  const loaded = validateMaterialLibrary(JSON.parse(JSON.stringify({ schema: 1, materials: [m] })));
  assert.deepEqual(loaded, [m]);
  loaded[0].density = 1;
  assert.equal(m.density, 1234);
  for (const patch of [
    { density: NaN },
    { density: -1 },
    { density: 0 },
    { color: 'red' },
    { category: 'unknown' },
    { name: '' },
  ])
    assert.throws(() => validateMaterialLibrary({ schema: 1, materials: [{ ...m, ...patch }] }));
});
test('versions merge without overwriting and conflicting imports fail atomically', () => {
  const newer = { ...m, revision: 2, density: 500 };
  const merged = mergeMaterials([m], [newer]);
  assert.equal(merged.length, 2);
  assert.deepEqual(latestMaterials(merged), [newer]);
  assert.equal(mergeMaterials(merged, [m]).length, 2);
  assert.throws(() => mergeMaterials([m], [{ ...m, density: 600 }]));
  assert.equal(m.density, 1234);
  assert.throws(() => validateMaterialLibrary({ schema: 1, materials: [m, m] }));
});
test('explicit object color overrides material default and unassigned objects retain fallback', () => {
  assert.equal(objectColor({ material: m }), m.color);
  assert.equal(objectColor({ material: m, colorOverride: '#ff0000' }), '#ff0000');
  assert.equal(objectColor({}), '#688391');
});
