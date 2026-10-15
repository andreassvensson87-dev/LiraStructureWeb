import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { IfcAPI, IFCBEAM, IFCCOLUMN, IFCMEMBER, IFCSIUNIT, IFCISHAPEPROFILEDEF } from 'web-ifc';
import { matchLibraryProfile } from '../src/references/profile-match.js';
import { createIFCProfileReader } from '../src/references/ifc-profile-data.js';
import { profileSnapshot, sectionProperties } from '../src/section-profile.js';
import { BUILTIN_PROFILES } from '../src/profile-catalog.js';
import { TIBNOR_PROFILES } from '../src/tibnor-catalog.js';
import { ifcPlacement } from '../src/references/ifc-coordinates.js';
import { convertReferencePart, planReferenceConversion } from '../src/references/conversion.js';
const examples = JSON.parse(
  readFileSync(new URL('./fixtures/revit-profile-evidence.json', import.meta.url), 'utf8'),
);
const hea = profileSnapshot(TIBNOR_PROFILES.find((p) => p.name === 'HEA 180'));

test('anonymised Revit examples preserve verified, probable, ambiguous and missing decisions deterministically', () => {
  for (const example of examples) {
    const before = structuredClone(example.evidence),
      result = matchLibraryProfile(example.evidence);
    assert.equal(result.status, example.expected.status, example.key);
    assert.equal(result.suggestion?.section.name || null, example.expected.profile, example.key);
    assert.deepEqual(example.evidence, before);
    assert.deepEqual(
      matchLibraryProfile(example.evidence, [...BUILTIN_PROFILES].reverse()).status,
      result.status,
    );
    if (result.status === 'none') assert.ok(result.reasons.includes('no-library-profile'));
    if (result.status === 'ambiguous') assert.equal(result.suggestion, null);
  }
});

test('names cannot override conflicting wall thickness or invent missing library sizes', () => {
  const source = structuredClone(examples.find((e) => e.key === 'hea180').evidence);
  source.profiles[0].dimensions.tw = 15;
  const mismatch = matchLibraryProfile(source);
  assert.equal(mismatch.status, 'none');
  assert.ok(mismatch.conflicts.some((c) => c.reason === 'profile-dimensions-conflict'));
  const nameOnly = matchLibraryProfile({ names: ['SB04- HEA180'] });
  assert.equal(nameOnly.status, 'probable');
  assert.equal(nameOnly.suggestion.section.name, 'HEA 180');
  const incomplete = { ...hea, parameters: {} };
  assert.equal(
    matchLibraryProfile(examples.find((e) => e.key === 'hea180').evidence, [incomplete]).status,
    'probable',
  );
  assert.equal(
    matchLibraryProfile({
      names: ['LT190x225'],
      material: 'Limträ',
      profiles: [{ kind: 'rect', dimensions: { B: 190, H: 225 } }],
    }).status,
    'none',
  );
  assert.equal(
    matchLibraryProfile({
      names: ['45x145'],
      material: 'Default Steel',
      profiles: [{ kind: 'rect', dimensions: { B: 45, H: 145 } }],
    }).status,
    'none',
  );
});

test('latest library revisions, mapped-scale warnings and ambiguous identical sections cannot silently select the first match', () => {
  const input = examples.find((e) => e.key === 'hea180').evidence;
  const def = TIBNOR_PROFILES.find((p) => p.name === 'HEA 180');
  const result = matchLibraryProfile(input, [def, { ...def, revision: 2 }]);
  assert.equal(result.suggestion.section.revision, 2);
  assert.equal(
    matchLibraryProfile({ ...input, warnings: ['mapped-scale'] }, [def]).status,
    'probable',
  );
  const duplicated = matchLibraryProfile(input, [def, { ...def, id: 'own-hea180' }]);
  assert.equal(duplicated.status, 'ambiguous');
  assert.equal(duplicated.suggestion, null);
});

test('IFC source dimensions have a bounded arc envelope, not a generally widened shape tolerance', () => {
  const loops = [
    [
      [-90, -85.5],
      [90, -85.5],
      [90, -76],
      [18, -76],
      [3, -61],
      [3, 61],
      [18, 76],
      [90, 76],
      [90, 85.5],
      [-90, 85.5],
      [-90, 76],
      [-18, 76],
      [-3, 61],
      [-3, -61],
      [-18, -76],
      [-90, -76],
    ],
  ];
  const geometry = { loops, properties: sectionProperties(loops) };
  const evidence = examples.find((e) => e.key === 'hea180').evidence;
  const result = matchLibraryProfile({ ...evidence, geometry });
  assert.equal(result.status, 'verified');
  assert.equal(result.suggestion.section.name, 'HEA 180');
  assert.ok(result.warnings.includes('coarse-tessellation'));
  assert.equal(
    matchLibraryProfile({ names: ['HEA180'], geometry }).status,
    'none',
    'a name does not permit coarse contour substitution',
  );
  const rectangle = [
    [
      [-90, -85.5],
      [90, -85.5],
      [90, 85.5],
      [-90, 85.5],
    ],
  ];
  assert.equal(
    matchLibraryProfile({
      ...evidence,
      geometry: { loops: rectangle, properties: sectionProperties(rectangle) },
    }).status,
    'none',
  );
  const rotated = hea.loops.map((loop) => loop.map(([x, y]) => [-y, x]));
  assert.equal(
    matchLibraryProfile({ geometry: { loops: rotated, properties: sectionProperties(rotated) } })
      .status,
    'verified',
  );
});

test('real IFC2x3 mapped profiles and Revit type/property data reach the matcher without reading UI or a source file path', async () => {
  const api = new IfcAPI();
  await api.Init();
  const m = api.OpenModel(
    readFileSync(new URL('./fixtures/revit-profile-sample.ifc', import.meta.url)),
    { COORDINATE_TO_ORIGIN: false, CIRCLE_SEGMENTS: 32 },
  );
  try {
    const read = createIFCProfileReader(api, m);
    let count = 0;
    for (const type of [IFCBEAM, IFCCOLUMN, IFCMEMBER]) {
      const ids = api.GetLineIDsWithType(m, type);
      for (let i = 0; i < ids.size(); i++) {
        const o = api.GetLine(m, ids.get(i)),
          source = read(o);
        const expected = examples.find((e) => source.names.includes(e.source));
        assert.ok(expected, o.Name.value);
        const result = matchLibraryProfile(source);
        assert.equal(result.status, expected.expected.status, expected.key);
        assert.equal(result.suggestion?.section.name || null, expected.expected.profile);
        if (expected.key === 'hea180')
          assert.ok(Math.abs(source.profiles[0].dimensions.B - 180) < 1e-8);
        if (expected.key === 'stud-rotated')
          assert.deepEqual(Object.keys(source.hints).sort(), ['B', 'H']);
        count++;
      }
    }
    assert.equal(count, examples.length);
    let tested = false;
    api.StreamAllMeshes(m, (mesh) => {
      const line = api.GetLine(m, mesh.expressID);
      if (!line.Name?.value.includes('HEA 180')) return;
      const part = mesh.geometries.get(0),
        raw = api.GetGeometry(m, part.geometryExpressID),
        vertices = api.GetVertexArray(raw.GetVertexData(), raw.GetVertexDataSize()),
        positions = [];
      for (let i = 0; i < vertices.length; i += 6)
        positions.push(vertices[i], vertices[i + 1], vertices[i + 2]);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(Array.from(api.GetIndexArray(raw.GetIndexData(), raw.GetIndexDataSize())));
      const candidate = { mesh: new THREE.Mesh(geometry) };
      candidate.mesh.applyMatrix4(ifcPlacement(part.flatTransformation));
      candidate.mesh.userData = {
        ifcId: mesh.expressID,
        ifcType: line.type,
        name: line.Name.value,
        profileEvidence: read(line),
      };
      let report;
      const converted = convertReferencePart(
        candidate,
        { title: 'QA', fileName: 'QA.ifc' },
        'sweep',
        undefined,
        (r) => (report = r),
      );
      assert.equal(converted.section.name, 'HEA 180');
      assert.equal(converted.material, undefined);
      assert.equal(report.status, 'verified');
      assert.ok(report.warnings.includes('coarse-tessellation'));
      const rows = planReferenceConversion(
        { parts: [candidate], title: 'QA', fileName: 'QA.ifc' },
        [],
        [mesh.expressID],
      );
      assert.equal(rows[0].profileMatch.status, 'verified');
      geometry.dispose();
      candidate.mesh.material.dispose();
      raw.delete();
      tested = true;
    });
    assert.ok(tested);
    const profileIds = api.GetLineIDsWithType(m, IFCISHAPEPROFILEDEF);
    const nominal = api.GetLine(m, profileIds.get(0));
    nominal.FilletRadius = null;
    api.WriteLine(m, nominal);
    const freshRead = createIFCProfileReader(api, m),
      beamIds = api.GetLineIDsWithType(m, IFCBEAM);
    for (let i = 0; i < beamIds.size(); i++) {
      const beam = api.GetLine(m, beamIds.get(i));
      if (!beam.Name.value.includes('HEA 180')) continue;
      const evidence = freshRead(beam);
      assert.equal(evidence.profiles[0].dimensions.R, 0);
      assert.equal(
        matchLibraryProfile(evidence).status,
        'none',
        'an omitted IFC2x3 root fillet cannot verify a rounded catalogue profile',
      );
    }
  } finally {
    api.CloseModel(m);
  }
});

test('IFC profile length units are normalised to millimetres independently of geometry or property hints', async () => {
  const api = new IfcAPI();
  await api.Init();
  const m = api.OpenModel(
    readFileSync(new URL('./fixtures/revit-profile-sample.ifc', import.meta.url)),
  );
  try {
    const units = api.GetLineIDsWithType(m, IFCSIUNIT);
    for (let i = 0; i < units.size(); i++) {
      const u = api.GetLine(m, units.get(i));
      if (u.UnitType.value === 'LENGTHUNIT') {
        u.Prefix = null;
        api.WriteLine(m, u);
      }
    }
    const ids = api.GetLineIDsWithType(m, IFCISHAPEPROFILEDEF);
    for (let i = 0; i < ids.size(); i++) {
      const p = api.GetLine(m, ids.get(i));
      for (const key of [
        'OverallWidth',
        'OverallDepth',
        'WebThickness',
        'FlangeThickness',
        'FilletRadius',
      ]) {
        if (typeof p[key] === 'number') p[key] /= 1000;
        else p[key].value /= 1000;
      }
      api.WriteLine(m, p);
    }
    const beams = api.GetLineIDsWithType(m, IFCBEAM),
      read = createIFCProfileReader(api, m);
    let tested = false;
    for (let i = 0; i < beams.size(); i++) {
      const b = api.GetLine(m, beams.get(i));
      if (!b.Name.value.includes('HEA 180')) continue;
      const evidence = read(b);
      assert.ok(Math.abs(evidence.profiles[0].dimensions.B - 180) < 1e-8);
      assert.equal(matchLibraryProfile(evidence).suggestion.section.name, 'HEA 180');
      assert.ok(
        matchLibraryProfile(evidence).warnings.includes('property-dimensions-conflict'),
        'unscaled property hints are reported, not trusted over the actual IFC profile',
      );
      tested = true;
    }
    assert.ok(tested);
  } finally {
    api.CloseModel(m);
  }
});
