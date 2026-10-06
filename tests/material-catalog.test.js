import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILTIN_MATERIALS,
  withMaterialCatalog,
  personalMaterials,
  materialRevision,
  materialGroups,
} from '../src/material-catalog.js';
import { validateMaterialLibrary, mergeMaterials, latestMaterials } from '../src/materials.js';

test('offline materials cover all approved groups with documented density defaults', () => {
  const library = withMaterialCatalog();
  assert.equal(library.length, 22);
  assert.deepEqual(
    materialGroups(library).map((g) => [g.id, g.count]),
    [
      ['steel', 5],
      ['concrete', 5],
      ['insulation', 6],
      ['wood', 6],
    ],
  );
  const density = Object.fromEntries(library.map((m) => [m.name, m.density]));
  assert.deepEqual(
    [density.C14, density.C24, density.GL28cs, density.GL28hs, density.GL30c, density.GL30h],
    [350, 420, 430, 480, 430, 480],
  );
  for (const m of library.filter((m) => ['concrete', 'insulation'].includes(m.category)))
    assert.match(m.note, /Schablondensitet/);
  library[0].density = 1;
  assert.equal(BUILTIN_MATERIALS[0].density, 7850);
});

test('personal storage, old libraries and full exports roundtrip without stock duplicates', () => {
  const old = {
    id: 'own',
    revision: 1,
    name: 'Egen betong',
    category: 'concrete',
    density: 2350,
    color: '#aabbcc',
  };
  const library = withMaterialCatalog([old]);
  assert.deepEqual(personalMaterials(library), [old]);
  assert.deepEqual(
    withMaterialCatalog(
      validateMaterialLibrary(
        JSON.parse(JSON.stringify({ schema: 1, materials: personalMaterials(library) })),
      ),
    ),
    library,
  );
  assert.deepEqual(
    mergeMaterials(library, validateMaterialLibrary({ schema: 1, materials: library })),
    library,
  );
  assert.throws(() => withMaterialCatalog([{ ...BUILTIN_MATERIALS[0], density: 1 }]), /Konflikt/);
  assert.equal(library.length, 23);
});

test('stock edits create personal identities and later revisions retain object snapshots', () => {
  const library = withMaterialCatalog();
  const stock = library.find((m) => m.name === 'Stenull');
  const snapshot = structuredClone(stock);
  const fields = {
    name: 'Stenull produkt 50',
    category: 'insulation',
    subgroup: 'Mineralull',
    density: 50,
    color: '#aabbcc',
  };
  const copy = materialRevision(library, stock, fields, 'new');
  assert.equal(copy.id, 'new');
  assert.equal(copy.revision, 1);
  assert.equal(copy.note, undefined);
  const merged = mergeMaterials(library, [copy]);
  const newer = materialRevision(merged, copy, { ...fields, density: 55 }, 'unused');
  assert.equal(newer.id, copy.id);
  assert.equal(newer.revision, 2);
  assert.equal(latestMaterials(mergeMaterials(merged, [newer])).length, 23);
  assert.deepEqual(snapshot, stock);
  assert.equal(snapshot.density, 30);
});

test('search traverses categories and subgroups and only groups latest versions', () => {
  const library = withMaterialCatalog();
  assert.equal(materialGroups(library, 'mineralull')[0].count, 2);
  assert.equal(materialGroups(library, 'BETONG')[0].count, 5);
  assert.equal(materialGroups(library, 'C30/37')[0].count, 1);
  assert.equal(materialGroups(library, 'missing').length, 0);
  const own = {
    id: 'old',
    revision: 1,
    category: 'steel',
    name: 'Eget',
    density: 7850,
    color: '#aabbcc',
  };
  const newer = { ...own, revision: 2, category: 'wood', subgroup: 'Specialträ', density: 500 };
  assert.equal(materialGroups([own, newer])[0].id, 'wood');
  assert.equal(materialGroups([own, newer])[0].groups[0].name, 'Specialträ');
  for (const patch of [
    { subgroup: 3 },
    { note: 'x'.repeat(501) },
    { source: 'javascript:alert(1)' },
  ])
    assert.throws(() => validateMaterialLibrary({ schema: 1, materials: [{ ...own, ...patch }] }));
});
