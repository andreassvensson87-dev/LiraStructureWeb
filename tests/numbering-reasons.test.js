import test from 'node:test';
import assert from 'node:assert/strict';
import { partKey, numberParts } from '../src/part-marks.js';
import { assemblyKey, assemblyMemberKeys } from '../src/assembly-numbering.js';
import { partChangeReasons, assemblyChangeReasons } from '../src/numbering/reasons.js';
import { planNumbering, defaultNumberingSettings } from '../src/numbering/plan.js';
const beam = (id = 'a', y = 0) => ({
  id,
  type: 'sweep',
  name: id,
  profile: 'rect',
  width: 100,
  height: 200,
  thickness: 0,
  rotation: 0,
  start: [0, y, 0],
  end: [1000, y, 0],
});
const material = { id: 'steel', name: 'S355', revision: 1, density: 7850 };
const cut = {
  id: 'cut',
  type: 'polygoncut',
  targets: ['a'],
  frame: { origin: [500, 0, 0], u: [1, 0, 0], v: [0, 1, 0] },
  polygon: [
    [0, 0],
    [100, 0],
    [100, 100],
  ],
  thickness: 1000,
  side: 'center',
};
function assemblyFixture() {
  const objects = [beam(), beam('b', 300)];
  const assembly = { id: 'as', mark: 'A-001', mainId: 'a', memberIds: ['a', 'b'] };
  assembly.typeKey = assemblyKey(assembly, objects);
  assembly.numberedMembers = assemblyMemberKeys(assembly, objects);
  return { objects, assembly };
}
const explainAssembly = (assembly, objects) =>
  assemblyChangeReasons(
    assembly,
    assemblyKey(assembly, objects),
    assemblyMemberKeys(assembly, objects),
  );
test('part reasons separate geometry, material, machining and simultaneous changes', () => {
  const source = beam(),
    before = partKey(source, [source]);
  assert.deepEqual(partChangeReasons(before, partKey({ ...source, width: 150 }, [])), [
    'Geometri/profil ändrad',
  ]);
  assert.deepEqual(partChangeReasons(before, partKey({ ...source, material }, [])), [
    'Material ändrat',
  ]);
  assert.deepEqual(partChangeReasons(before, partKey(source, [source, cut])), [
    'Bearbetning ändrad',
  ]);
  assert.deepEqual(partChangeReasons(before, partKey({ ...source, width: 150, material }, [cut])), [
    'Geometri/profil ändrad',
    'Material ändrat',
    'Bearbetning ändrad',
  ]);
});
test('hole changes are distinguished from contour machining without inventing insertion changes', () => {
  const before = JSON.parse(partKey(beam(), []));
  const hole = JSON.stringify({ type: 'linkedhole', diameter: 18, depth: 200 });
  const next = {
    ...before,
    cuts: [hole],
    placement: { horizontalAlignment: 'center', verticalAlignment: 'center' },
  };
  assert.deepEqual(partChangeReasons(JSON.stringify(before), JSON.stringify(next)), [
    'Hålbild ändrad',
  ]);
  assert.deepEqual(partChangeReasons(JSON.stringify(next), JSON.stringify(before)), [
    'Hålbild ändrad',
  ]);
  const moved = { ...next, placement: { ...next.placement, horizontalAlignment: 'left' } };
  assert.deepEqual(partChangeReasons(JSON.stringify(next), JSON.stringify(moved)), [
    'Insättning ändrad',
  ]);
  const combined = { ...next, cuts: [hole, JSON.stringify({ type: 'polygoncut' })] };
  assert.deepEqual(partChangeReasons(JSON.stringify(before), JSON.stringify(combined)), [
    'Hålbild ändrad',
    'Bearbetning ändrad',
  ]);
});
test('translations, free profile rotation, names and colour produce no manufacturing reason', () => {
  const source = { ...beam(), material: { ...material, color: '#111111' } };
  const moved = {
    ...source,
    name: 'Annat namn',
    rotation: 90,
    start: [200, 400, 0],
    end: [1200, 400, 0],
    material: { ...material, color: '#999999' },
  };
  assert.deepEqual(partChangeReasons(partKey(source, []), partKey(moved, [])), []);
});
test('assembly reasons identify member geometry, placement, main part and member count', () => {
  const { objects, assembly } = assemblyFixture();
  const wider = objects.map((o) => (o.id === 'b' ? { ...o, width: 150 } : o));
  assert.deepEqual(explainAssembly(assembly, wider), ['Delarnas geometri/profil ändrad']);
  const moved = objects.map((o) =>
    o.id === 'b' ? { ...o, start: [0, 400, 0], end: [1000, 400, 0] } : o,
  );
  assert.deepEqual(explainAssembly(assembly, moved), ['Delarnas placering ändrad']);
  assert.ok(explainAssembly({ ...assembly, mainId: 'b' }, objects).includes('Huvuddel ändrad'));
  const added = [...objects, beam('c', 600)];
  assert.ok(
    explainAssembly({ ...assembly, memberIds: ['a', 'b', 'c'] }, added).includes(
      'Antal delar ändrat',
    ),
  );
});
test('assembly member orientation is explained independently of free-part geometry', () => {
  const { objects, assembly } = assemblyFixture();
  const rotated = objects.map((o) => (o.id === 'b' ? { ...o, rotation: 90 } : o));
  assert.deepEqual(explainAssembly(assembly, rotated), ['Delarnas orientering ändrad']);
});
test('legacy assembly keys and replacement members are explained without guessing ID pairs', () => {
  const { objects, assembly } = assemblyFixture();
  const legacy = { ...assembly };
  delete legacy.numberedMembers;
  const changed = objects.map((o) => (o.id === 'b' ? { ...o, material } : o));
  assert.deepEqual(explainAssembly(legacy, changed), ['Delarnas material ändrat']);
  const replacement = changed.map((o) => (o.id === 'b' ? { ...o, id: 'replacement' } : o));
  assert.deepEqual(explainAssembly({ ...assembly, memberIds: ['a', 'replacement'] }, replacement), [
    'Delarnas material ändrat',
  ]);
  assert.deepEqual(partChangeReasons('unknown-old-format', partKey(beam(), [])), [
    'Tidigare jämförelsedata saknas',
  ]);
  assert.deepEqual(
    assemblyChangeReasons({ typeKey: 'unknown' }, assembly.typeKey, assembly.numberedMembers),
    ['Tidigare jämförelsedata saknas'],
  );
});
test('preview exposes reasons only for changes and keeps existing number allocation unchanged', () => {
  const objects = [beam(), beam('b', 300)],
    parts = numberParts(objects);
  const state = {
    objects: [{ ...objects[0], width: 150, material }, objects[1], beam('new', 600)],
    parts,
    assemblies: [],
    drawings: [],
    assemblyNumbering: { registry: [] },
  };
  const before = structuredClone(state);
  const plan = planNumbering(state, { ...defaultNumberingSettings(), assemblies: false });
  assert.deepEqual(plan.rows.find((r) => r.status === 'changed').reasons, [
    'Geometri/profil ändrad',
    'Material ändrat',
  ]);
  assert.ok(plan.rows.filter((r) => r.status !== 'changed').every((r) => r.reasons.length === 0));
  assert.deepEqual(
    plan.parts.parts,
    numberParts(state.objects, parts, {}, { ...defaultNumberingSettings(), assemblies: false }),
  );
  assert.deepEqual(state, before);
});
