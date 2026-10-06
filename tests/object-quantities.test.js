import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { objectQuantities, meshVolume } from '../src/model/object-quantities.js';
import { suggestedProfileMaterial, profileMaterialSuggestions } from '../src/profile-material.js';
import { withMaterialCatalog } from '../src/material-catalog.js';
import { TIMBER_PROFILES } from '../src/timber-catalog.js';
import { TIBNOR_PROFILES } from '../src/tibnor-catalog.js';
import { profileSnapshot } from '../src/section-profile.js';
import { profileDisplayObject } from '../src/profile-detail.js';
import { createProject } from '../src/project/project-state.js';
import { parseProjectFile, serializeProject } from '../src/project/project-file.js';

const materials = withMaterialCatalog();
const material = (name) => structuredClone(materials.find((m) => m.name === name));
const beam = (patch = {}) => ({
  id: 'beam',
  type: 'sweep',
  name: 'Balk',
  prefix: 'B',
  number: 1,
  profile: 'rect',
  width: 100,
  height: 200,
  thickness: 0,
  rotation: 0,
  start: [0, 0, 0],
  end: [3000, 0, 0],
  ...patch,
});
const libraryBeam = (definition, patch = {}) => {
  const section = profileSnapshot(definition);
  return beam({
    profile: 'custom',
    section,
    width: section.properties.bounds.width,
    height: section.properties.bounds.height,
    ...patch,
  });
};
const near = (actual, expected, tolerance = 1e-8) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)),
    `${actual} ≠ ${expected}`,
  );

test('grade proposals preserve explicit choices, reject ambiguity and never grade ungraded stock', () => {
  const c24 = TIMBER_PROFILES.find((p) => p.name === 'Träregel 45x145');
  assert.deepEqual(
    profileMaterialSuggestions(c24, materials).map((m) => m.name),
    ['C24'],
  );
  assert.equal(suggestedProfileMaterial(c24, null, materials, true).name, 'C24');
  const explicit = material('GL30h');
  assert.deepEqual(suggestedProfileMaterial(c24, explicit, materials, false), explicit);
  assert.deepEqual(
    profileMaterialSuggestions({ standard: 'S235JR / S355J2 · EN 10025' }, materials).map(
      (m) => m.name,
    ),
    ['S235JR', 'S355J2'],
  );
  assert.equal(
    suggestedProfileMaterial({ standard: 'S235JR/S355J2' }, material('C24'), materials, true),
    null,
  );
  assert.equal(
    profileMaterialSuggestions(
      TIMBER_PROFILES.find((p) => p.name === 'Träregel 45x45'),
      materials,
    ).length,
    0,
  );
  assert.equal(suggestedProfileMaterial({ standard: 'EN 336' }, explicit, materials, true), null);
  const copy = suggestedProfileMaterial(c24, null, materials, true);
  copy.density = 1;
  assert.equal(material('C24').density, 420);
});

test('material density drives object mass while profile catalog mass stays independent', () => {
  const source = libraryBeam(
    TIMBER_PROFILES.find((p) => p.name === 'Träregel 45x145'),
    { material: material('C24') },
  );
  const before = JSON.stringify(source);
  const q = objectQuantities(source);
  near(q.lengthMm, 3000);
  near(q.areaMm2, 45 * 145);
  near(q.volumeM3, 45 * 145 * 3000 * 1e-9);
  near(q.massKg, q.volumeM3 * 420);
  near(q.massPerMeter, 45 * 145 * 420 * 1e-6);
  const changed = objectQuantities({ ...source, material: material('GL30h') });
  near(changed.massKg / q.massKg, 480 / 420);
  assert.equal(JSON.stringify(source), before);
  const unassigned = objectQuantities({ ...source, material: null });
  assert.equal(unassigned.densitySource, 'profile');
  near(unassigned.massKg, q.massKg);
  assert.equal(objectQuantities(beam()).massKg, null);
  assert.equal(objectQuantities(beam({ section: source.section })).densityKgM3, null);
  assert.throws(() => objectQuantities(beam({ material: { density: NaN } })), /densitet/);
});

test('linked bores reduce plate volume and weight without counting the display-only surface', () => {
  const model = JSON.parse(
    readFileSync(new URL('../examples/forbandstest.lira.json', import.meta.url)),
  ).project.objects;
  const plate = model.find((s) => s.type === 'plate');
  const gross = objectQuantities(plate);
  const net = objectQuantities(plate, model);
  assert.equal(net.cutCount, 1);
  assert.ok(net.volumeM3 < gross.volumeM3);
  near(gross.volumeM3 - net.volumeM3, Math.PI * 11 ** 2 * 12 * 1e-9, 1e-7);
  near(net.massKg, net.volumeM3 * plate.material.density);
});

test('physical radius contours and circular analytic area do not depend on display or location', () => {
  const source = libraryBeam(
    TIBNOR_PROFILES.find((p) => p.name === 'HEA 200'),
    { material: material('S355J2') },
  );
  const exact = objectQuantities(source);
  assert.deepEqual(objectQuantities(profileDisplayObject(source, 'schematic')), exact);
  assert.deepEqual(
    objectQuantities({
      ...source,
      start: [1000000, -2000000, 3000000],
      end: [1000000, -2000000, 3003000],
      rotation: 89,
    }),
    exact,
  );
  for (const patch of [
    { profile: 'circle', width: 100 },
    { profile: 'chs', width: 100, thickness: 5 },
  ]) {
    const object = beam({ ...patch, material: material('S355J2H') });
    const area = Math.PI * (50 ** 2 - (patch.profile === 'chs' ? 45 ** 2 : 0));
    near(objectQuantities(object).areaMm2, area);
    near(objectQuantities(object).massKg, area * 3000 * 7850 * 1e-9);
  }
});

test('plates and cuts share net-volume mass rules and empty geometry has zero mass', () => {
  const plate = {
    id: 'plate',
    type: 'plate',
    name: 'Platta',
    frame: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0] },
    polygon: [
      [0, 0],
      [1000, 0],
      [1000, 2000],
      [0, 2000],
    ],
    thickness: 100,
    side: 'positive',
    material: material('C30/37'),
  };
  near(objectQuantities(plate).volumeM3, 0.2);
  near(objectQuantities(plate).massKg, 480);
  const source = beam({ end: [1000, 0, 0], material: material('S355J2') });
  const cut = {
    id: 'cut',
    type: 'polygoncut',
    frame: { origin: [0, 0, -500], u: [1, 0, 0], v: [0, 1, 0] },
    polygon: [
      [500, -500],
      [1500, -500],
      [1500, 500],
      [500, 500],
    ],
    thickness: 1000,
    side: 'positive',
    targets: ['beam'],
  };
  const q = objectQuantities(source, [source, cut]);
  near(q.grossVolumeM3, 0.02);
  near(q.volumeM3, 0.01, 1e-5);
  near(q.massKg, 78.5, 1e-5);
  assert.equal(q.cutCount, 1);
  assert.equal(q.approximate, true);
  assert.equal(objectQuantities(cut), null);
  const completeCut = {
    ...cut,
    polygon: [
      [-1000, -500],
      [1500, -500],
      [1500, 500],
      [-1000, 500],
    ],
  };
  near(objectQuantities(source, [source, completeCut]).massKg, 0);
  const box = new THREE.BoxGeometry(100, 200, 300);
  try {
    near(meshVolume(box), 6000000);
    box.translate(1000000, -2000000, 3000000);
    near(meshVolume(box), 6000000);
    near(meshVolume(new THREE.BufferGeometry()), 0);
  } finally {
    box.dispose();
  }
});

test('quantities remain derived after project reload and explicit material changes retain snapshots', () => {
  const source = libraryBeam(
    TIMBER_PROFILES.find((p) => p.name === 'Limträ 115x315'),
    { material: material('GL30c') },
  );
  const project = createProject({
    grid: { x: [0, 6000], y: [0, 6000] },
    levels: { active: 'level', items: [{ id: 'level', name: 'Plan 1', elevation: 0 }] },
  });
  project.objects.push(source);
  const reloaded = parseProjectFile(serializeProject(project)).objects[0];
  assert.deepEqual(objectQuantities(reloaded), objectQuantities(source));
  reloaded.material.density = 500;
  assert.equal(source.material.density, 430);
  assert.equal(source.section.density, 430);
  assert.ok(objectQuantities(reloaded).massKg > objectQuantities(source).massKg);
});
