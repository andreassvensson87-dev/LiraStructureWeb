import test from 'node:test';
import assert from 'node:assert/strict';
import { TIBNOR_PROFILES, withTibnorCatalog, personalProfiles } from '../src/tibnor-catalog.js';
import { evaluateSection, profileSnapshot, validateLibrary } from '../src/section-profile.js';
import { sweepGeometry, validateSweep } from '../src/sweep.js';
import { createProject } from '../src/project/project-state.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';

test('Tibnor 2023 contains every imported row with stable unique identities', () => {
  assert.equal(TIBNOR_PROFILES.length, 901);
  assert.equal(new Set(TIBNOR_PROFILES.map((p) => p.id)).size, 901);
  for (const [family, count] of [
    ['IPE', 18],
    ['HEA', 24],
    ['HEB', 24],
    ['HEM', 24],
    ['T', 11],
    ['UPE', 14],
    ['U/UPN', 23],
    ['L liksidig', 59],
    ['L oliksidig', 49],
    ['VKR kvadratisk', 65],
    ['VKR rektangulär', 77],
    ['KKR kvadratisk', 58],
    ['KKR rektangulär', 64],
    ['Runda svetsade', 38],
    ['Runda sömlösa', 353],
  ])
    assert.equal(TIBNOR_PROFILES.filter((p) => p.family === family).length, count);
  assert.equal(
    validateLibrary(JSON.parse(JSON.stringify({ schema: 1, profiles: TIBNOR_PROFILES }))).length,
    901,
  );
});

test('reference rows map actual dimensions, axes and unit multipliers from tables 004–006', () => {
  const ipe = TIBNOR_PROFILES.find((p) => p.name === 'IPE 200');
  assert.deepEqual(ipe.catalog, {
    A: 2848,
    massPerMeter: 22.4,
    Ix: 19430000,
    Iy: 1420000,
    Wx: 194000,
    Wy: 28500,
    J: 70200,
  });
  const hea = profileSnapshot(TIBNOR_PROFILES.find((p) => p.name === 'HEA 200'));
  assert.equal(hea.parameters.H, 190); // Nominal size is not the actual height.
  assert.equal(hea.parameters.tw, 6.5);
  assert.equal(hea.parameters.tf, 10);
  assert.equal(hea.parameters.R, 18);
  assert.equal(hea.properties.bounds.height, 190);
  assert.equal(hea.catalog.massPerMeter, 42.3);
  const heb = profileSnapshot(TIBNOR_PROFILES.find((p) => p.name === 'HEB 1000'));
  assert.equal(heb.catalog.J, 12600000);
  assert.equal(heb.catalog.Ix, 6447000000);
});

test('all rounded contours agree with catalog area and moments within table rounding and segmentation', () => {
  for (const p of TIBNOR_PROFILES.filter((p) => ['i', 'h'].includes(p.profileType))) {
    const { properties: s, loops } = evaluateSection(p);
    assert.equal(loops.length, 1);
    assert.ok(Math.abs(s.cx) < 1e-8 && Math.abs(s.cy) < 1e-8, p.name);
    for (const key of ['A', 'Ix', 'Iy'])
      assert.ok(Math.abs(s[key] / p.catalog[key] - 1) < 0.01, `${p.name} ${key}`);
    const copy = JSON.parse(JSON.stringify(profileSnapshot(p)));
    assert.deepEqual(copy.catalog, p.catalog);
    assert.equal(copy.loops[0].length, loops[0].length);
  }
});

test('bundled catalog survives storage reloads, preserves personal versions and rejects conflicts', () => {
  const custom = { ...structuredClone(TIBNOR_PROFILES[0]), id: 'personal', name: 'Min balk' };
  const next = withTibnorCatalog([custom, { ...custom, revision: 2 }]);
  assert.equal(next.length, 903);
  const stored = personalProfiles(next);
  assert.equal(stored.length, 2);
  assert.deepEqual(withTibnorCatalog(JSON.parse(JSON.stringify(stored))), next);
  assert.deepEqual(withTibnorCatalog(next), next); // Full exports can be imported again.
  assert.throws(() => withTibnorCatalog([{ ...TIBNOR_PROFILES[0], name: 'Konflikt' }]), /Konflikt/);
  assert.equal(personalProfiles(withTibnorCatalog([])).length, 0);
});

test('rounded roots follow dimension edits and reject radii that no longer fit', () => {
  const p = structuredClone(TIBNOR_PROFILES[6]);
  p.parameters.find((v) => v.name === 'H').value = 250;
  assert.equal(evaluateSection(p).properties.bounds.height, 250);
  p.parameters.find((v) => v.name === 'R').value = 100;
  assert.throws(() => evaluateSection(p), /Hålkälsradien/);
});

test('catalog beams keep their geometry and catalog snapshots through project save and reload', () => {
  const project = createProject({
    grid: { x: [0, 1000], y: [0, 1000] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  for (const family of [
    'IPE',
    'HEA',
    'HEB',
    'HEM',
    'UPE',
    'U',
    'L',
    'VKR',
    'KKR',
    'KCKR',
    'CHS',
    'T',
  ]) {
    const section = profileSnapshot(
      TIBNOR_PROFILES.find(
        (p) =>
          p.name ===
          (family === 'T'
            ? 'T 100x100'
            : ['KCKR', 'CHS'].includes(family)
              ? family + ' 139.7x8'
              : family === 'L'
                ? 'L 100x65x8'
                : ['VKR', 'KKR'].includes(family)
                  ? family + ' 200x100x8'
                  : family + ' 200'),
      ),
    );
    project.objects.push({
      id: family,
      type: 'sweep',
      name: section.name,
      profile: 'custom',
      section,
      width: section.properties.bounds.width,
      height: section.properties.bounds.height,
      thickness: 10,
      rotation: 37,
      start: [100, 200, 300],
      end: [100, 200, 3300],
    });
  }
  const loaded = parseProjectFile(serializeProject(project));
  for (const [i, beam] of loaded.objects.entries()) {
    assert.deepEqual(beam.section, JSON.parse(JSON.stringify(project.objects[i].section)));
    assert.equal(validateSweep(beam), '');
    const geometry = sweepGeometry(beam);
    assert.ok(Array.from(geometry.attributes.position.array).every(Number.isFinite));
    geometry.computeBoundingBox();
    assert.equal(geometry.boundingBox.min.z, 300);
    assert.equal(geometry.boundingBox.max.z, 3300);
    geometry.dispose();
  }
});
