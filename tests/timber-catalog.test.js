import test from 'node:test';
import assert from 'node:assert/strict';
import { TIMBER_PROFILES } from '../src/timber-catalog.js';
import {
  BUILTIN_PROFILES,
  withBuiltinCatalog,
  personalProfiles,
  isBuiltinProfile,
} from '../src/profile-catalog.js';
import { evaluateSection, profileSnapshot, validateLibrary } from '../src/section-profile.js';
import { libraryGroups } from '../src/profile-tree.js';
import { profileDisplayObject } from '../src/profile-detail.js';
import { createSnapGeometryContext, displayGeometry } from '../src/model-object.js';
import { createProject } from '../src/project/project-state.js';
import { parseProjectFile, serializeProject } from '../src/project/project-file.js';

const find = (name) => TIMBER_PROFILES.find((p) => p.name === name);
const object = (def) => {
  const section = profileSnapshot(def);
  return {
    id: def.id,
    type: 'sweep',
    profile: 'custom',
    name: def.name,
    section,
    width: section.properties.bounds.width,
    height: section.properties.bounds.height,
    thickness: 0,
    rotation: 23,
    start: [0, 0, 0],
    end: [3000, 0, 0],
  };
};
test('stock timber dimensions have unique identities, valid rectangular geometry and wood densities', () => {
  assert.equal(TIMBER_PROFILES.length, 42);
  assert.equal(BUILTIN_PROFILES.length, 943);
  assert.equal(new Set(BUILTIN_PROFILES.map((p) => p.id)).size, 943);
  assert.equal(validateLibrary({ schema: 1, profiles: BUILTIN_PROFILES }).length, 943);
  for (const def of TIMBER_PROFILES) {
    const {
      properties: s,
      parameters: { B, H },
      loops,
    } = evaluateSection(def);
    assert.deepEqual(
      loops.map((l) => l.length),
      [4],
    );
    assert.equal(s.A, B * H);
    assert.ok(Math.abs(s.Ix / ((B * H ** 3) / 12) - 1) < 1e-12);
    assert.ok(Math.abs(s.Iy / ((H * B ** 3) / 12) - 1) < 1e-12);
    assert.ok(Math.abs(s.massPerMeter / ((B * H * def.density) / 1e6) - 1) < 1e-12);
    assert.ok(def.density >= 420 && def.density <= 480);
    assert.equal(s.bounds.width, B);
    assert.equal(s.bounds.height, H);
    assert.equal(def.radiusParameters, undefined);
  }
  assert.match(find('Träregel 45x145').standard, /C24/);
  assert.doesNotMatch(find('Träregel 45x45').standard, /C24/);
  assert.equal(find('Limträ 115x315').density, 430);
  assert.equal(find('Limträ 140x135').density, 480);
  assert.match(find('Limträ 140x135').standard, /GL30h/);
  assert.match(find('Limträ klyvsågat 42x180').standard, /GL28cs/);
  assert.equal(find('Limträ 190x945'), undefined); // Manufacturing sizes are not stock rows.
});
test('wood forms one compact group, remains searchable and never duplicates generic rectangle families', () => {
  const tree = libraryGroups(BUILTIN_PROFILES),
    timber = tree.find((g) => g.id === 'timber');
  assert.deepEqual(
    timber.families.map((f) => [f.label, f.sizes.length]),
    [
      ['Klyvsågat limträ GL28cs', 7],
      ['Limträbalkar GL30c', 21],
      ['Limträpelare GL30h', 5],
      ['Träreglar', 9],
    ],
  );
  assert.equal(tree.flatMap((g) => g.families).flatMap((f) => f.sizes).length, 943);
  assert.equal(libraryGroups(BUILTIN_PROFILES, 'Trä')[0].id, 'timber');
  assert.equal(libraryGroups(BUILTIN_PROFILES, 'GL30h')[0].families[0].sizes.length, 5);
  assert.equal(
    libraryGroups(BUILTIN_PROFILES, 'Träregel45x145')[0].families[0].sizes[0].latest.name,
    'Träregel 45x145',
  );
  const def = find('Träregel 45x145'),
    changed = { ...def, revision: 2, libraryGroup: 'bars' };
  const moved = libraryGroups([def, changed]);
  assert.equal(moved.length, 1);
  assert.equal(moved[0].id, 'bars');
  assert.equal(moved[0].families[0].sizes[0].versions.length, 2);
});
test('combined offline catalog preserves personal definitions, full exports and old steel-only imports', () => {
  const personal = { ...structuredClone(find('Limträ 115x315')), id: 'personal-wood' };
  const all = withBuiltinCatalog([personal]);
  assert.equal(all.length, 944);
  assert.ok(isBuiltinProfile(find('Träregel 45x145')));
  assert.deepEqual(personalProfiles(all), [personal]);
  assert.deepEqual(withBuiltinCatalog(JSON.parse(JSON.stringify(personalProfiles(all)))), all);
  assert.deepEqual(withBuiltinCatalog(all), all);
  assert.equal(
    withBuiltinCatalog(BUILTIN_PROFILES.filter((p) => p.id.startsWith('tibnor-'))).length,
    943,
  );
  assert.throws(
    () => withBuiltinCatalog([{ ...find('Limträ 115x315'), density: 7850 }]),
    /Konflikt/,
  );
});
test('timber project snapshots keep size, class, density and eight theoretical model end snaps', () => {
  const project = createProject({
    grid: { x: [0, 1000], y: [0, 1000] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  project.objects = [
    'Träregel 45x145',
    'Limträ 115x315',
    'Limträ 140x135',
    'Limträ klyvsågat 42x180',
  ].map((name) => object(find(name)));
  const loaded = parseProjectFile(serializeProject(project));
  for (const [i, obj] of loaded.objects.entries()) {
    assert.deepEqual(obj.section, JSON.parse(JSON.stringify(project.objects[i].section)));
    assert.equal(profileDisplayObject(obj), obj);
    assert.equal(profileDisplayObject(obj, 'exact'), obj);
    const snaps = createSnapGeometryContext([obj]).objectCorners(obj);
    assert.equal(snaps.length, 8);
    assert.deepEqual(
      snaps,
      createSnapGeometryContext([obj], { profileDetail: 'exact' }).objectCorners(obj),
    );
    const exact = displayGeometry(obj, [obj], 'exact'),
      schematic = displayGeometry(obj, [obj]);
    assert.deepEqual(exact.attributes.position.array, schematic.attributes.position.array);
    exact.dispose();
    schematic.dispose();
  }
  const edited = structuredClone(find('Träregel 45x145'));
  edited.parameters.find((p) => p.name === 'H').value = 170;
  assert.equal(evaluateSection(edited).properties.bounds.height, 170);
  edited.parameters.find((p) => p.name === 'B').value = -1;
  assert.throws(() => evaluateSection(edited), /positiva/);
});
