import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseModelImport,
  planModelImport,
  modelImportObjects,
  modelImportSelectionIssues,
} from '../src/project/model-import.js';
import { BUILTIN_PROFILES } from '../src/profile-catalog.js';
import { BUILTIN_MATERIALS } from '../src/material-catalog.js';
import { createModelEditor } from '../src/app/model-editor.js';
import { createProject } from '../src/project/project-state.js';
import { ProjectHistory } from '../src/project/project-history.js';
import { initialLevels } from '../src/levels.js';
import { defaultGrid } from '../src/grid-lines.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
import { geometryForModel } from '../src/model-object.js';
import { lineCutFrame } from '../src/line-cut.js';
import { pointerCommand } from '../src/model/pointer-controller.js';

const example = () =>
  parseModelImport(
    readFileSync(new URL('../src/project/model-import-example.json', import.meta.url), 'utf8'),
  );
const libraries = { profiles: BUILTIN_PROFILES, materials: BUILTIN_MATERIALS };
test('review is detached; selected native parts commit, save and undo/redo together', () => {
  const project = createProject({ grid: defaultGrid, levels: initialLevels() });
  const history = new ProjectHistory();
  const before = structuredClone(project);
  let checkpoints = 0;
  const editor = createModelEditor({
    project,
    checkpoint() {
      checkpoints++;
      history.checkpoint(project);
    },
  });
  const data = example(),
    rows = planModelImport(data, { ...libraries, objects: project.objects });
  assert.deepEqual(
    rows.map((r) => r.error),
    ['', '', '', '', ''],
  );
  const included = new Set(['P01', 'B01', 'PL01']);
  const batch = modelImportObjects(data, rows, included, new Set(), project.objects);
  assert.deepEqual(project, before);
  assert.equal(checkpoints, 0);
  assert.equal(batch.length, 3);
  assert.equal(batch[0].section.name, 'HEA 200');
  assert.equal(batch[0].ifcClass, 'IfcColumn');
  assert.equal(batch[0].material.name, 'S355J2');
  assert.equal(batch[2].type, 'plate');
  assert.equal(new Set(batch.map((o) => o.id)).size, 3);
  assert.ok(batch.every((o) => !included.has(o.id)));
  assert.deepEqual(batch[1].start, [0, 0, 3500]);
  assert.equal(batch[2].side, 'negative');
  editor.add(batch);
  assert.equal(checkpoints, 1);
  const loaded = parseProjectFile(serializeProject(project));
  assert.equal(loaded.objects.find((o) => o.id === batch[0].id).ifcClass, 'IfcColumn');
  assert.deepEqual(
    loaded.objects.find((o) => o.id === batch[0].id).modelImport,
    batch[0].modelImport,
  );
  const rerun = planModelImport(data, { ...libraries, objects: loaded.objects });
  assert.match(rerun[0].error, /Redan importerad/);
  assert.equal(rerun[1].error, ''); // A previously excluded object remains importable.
  assert.throws(
    () => modelImportObjects(data, rows, included, new Set(), loaded.objects),
    /redan importerad/,
  );
  Object.assign(project, history.undo(project));
  assert.deepEqual(project, before);
  Object.assign(project, history.redo(project));
  assert.equal(project.objects.filter((o) => o.modelImport).length, 3);
});
test('assumptions require an explicit decision; invalid rows cannot slip through selection', () => {
  const data = example();
  data.objects[0].end = data.objects[0].start;
  const rows = planModelImport(data, libraries);
  assert.match(rows[0].error, /minst 1 mm/);
  assert.throws(
    () => modelImportObjects(data, rows, new Set(['P01']), new Set(), []),
    /minst 1 mm/,
  );
  assert.throws(
    () => modelImportObjects(data, rows, new Set(['B02']), new Set(), []),
    /bekräfta antagandena/,
  );
  const [accepted] = modelImportObjects(data, rows, new Set(['B02']), new Set(['B02']), []);
  assert.equal(accepted.modelImport.assumptionsAccepted, true);
  data.objects[2].assumptions = ['Andra antagandet i samma import.'];
  const batchRows = planModelImport(data, libraries);
  const selected = new Set(['B01', 'B02']);
  assert.throws(
    () => modelImportObjects(data, batchRows, selected, new Set(['B02']), []),
    /bekräfta antagandena/,
  );
  const batch = modelImportObjects(data, batchRows, selected, new Set(selected), []);
  assert.equal(batch.length, 2);
  assert.ok(batch.every((object) => object.modelImport.assumptionsAccepted));

  assert.deepEqual(accepted.modelImport.assumptions, data.objects[3].assumptions);
  assert.throws(() => modelImportObjects(data, rows, new Set(), new Set(), []), /minst ett/);
});
test('file boundary rejects wrong units, versions, duplicate IDs and unsupported metadata', () => {
  for (const [field, value] of [
    ['version', 3],
    ['units', 'm'],
    ['coordinates', 'world'],
  ]) {
    const data = example();
    data[field] = value;
    assert.throws(() => parseModelImport(JSON.stringify(data)));
  }
  const data = example();
  data.objects[1].id = data.objects[0].id;
  assert.throws(() => parseModelImport(JSON.stringify(data)), /unika id/);
  assert.throws(() => parseModelImport('{'), /giltig JSON/);
  const invalid = example();
  invalid.objects[0].start = [0, 0];
  invalid.objects[1].generatedBy = 'fake';
  invalid.objects[2].assumptions = 'not-an-array';
  invalid.objects[3].ifcClass = 'IfcNotAClass';
  const rows = planModelImport(invalid, libraries);
  assert.match(rows[0].error, /tre giltiga/);
  assert.match(rows[1].error, /Okänt fält/);
  assert.match(rows[2].error, /Antaganden/);
  assert.match(rows[3].error, /IFC-klass/);
  assert.equal(rows[4].error, '');
});
test('profile/material matching never guesses a grade; explicit library choices repair unresolved names', () => {
  const data = example();
  data.objects[0].material = 'S355';
  data.objects[1].profile = 'unknown';
  let rows = planModelImport(data, libraries);
  assert.match(rows[0].error, /saknas/);
  assert.match(rows[1].error, /saknas/);
  const material = BUILTIN_MATERIALS.find((m) => m.name === 'S355J2');
  const profile = BUILTIN_PROFILES.find((p) => p.name === 'HEA 200');
  rows = planModelImport(
    data,
    libraries,
    new Map([
      ['P01', { material }],
      ['P02', { profile }],
    ]),
  );
  assert.equal(rows[0].error, '');
  assert.equal(rows[1].error, '');
  assert.equal(data.objects[0].material, 'S355');
  const ambiguous = planModelImport(example(), {
    ...libraries,
    profiles: [...BUILTIN_PROFILES, { ...profile, id: 'other-profile' }],
  });
  assert.match(ambiguous[0].error, /tvetydigt/);
});
test('preview picking routes through the normal pointer controller without starting a modeling command', () => {
  assert.equal(pointerCommand({ mode: 'modelImport', drawing: false }), 'model-import');
});

const operations = () =>
  parseModelImport(
    readFileSync(
      new URL('../src/project/model-import-operations-example.json', import.meta.url),
      'utf8',
    ),
  );
test('v2 native fits and notch keep references through commit, save, edit and undo', () => {
  const data = operations();
  // Operations may precede their referenced members in an AI response.
  data.objects.reverse();
  const rows = planModelImport(data, libraries);
  assert.ok(
    rows.every((row) => !row.error),
    rows.map((r) => r.error).join(';'),
  );
  const selected = new Set(rows.map((r) => r.id));
  const batch = modelImportObjects(data, rows, selected, new Set(), []);
  const withoutCut = new Set(selected);
  withoutCut.delete('C01');
  assert.ok(
    modelImportObjects(data, rows, withoutCut, new Set(), []).every((o) => o.type !== 'polygoncut'),
  );
  const bySource = (objects, id) => objects.find((o) => o.modelImport?.objectId === id);
  const beam = bySource(batch, 'B01');
  const fits = batch.filter((o) => o.type === 'component');
  assert.equal(fits.length, 2);
  assert.ok(fits.every((o) => o.kind === 'fit' && o.references.includes(beam.id)));
  const notch = bySource(batch, 'C01');
  assert.deepEqual(notch.targets, [beam.id]);
  for (const [id, x] of [
    ['F01', 100],
    ['F02', 5900],
  ])
    assert.ok(Math.abs(lineCutFrame(bySource(batch, id).cuts[0]).origin.x - x) < 1e-6);
  const geometry = geometryForModel(beam, batch);
  geometry.computeBoundingBox();
  assert.ok(Math.abs(geometry.boundingBox.min.x - 100) < 0.02);
  assert.ok(Math.abs(geometry.boundingBox.max.x - 5900) < 0.02);
  const volume = (g) => {
    const p = g.getAttribute('position');
    let sum = 0;
    for (let i = 0; i < p.count; i += 3) {
      const a = [p.getX(i), p.getY(i), p.getZ(i)];
      const b = [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)];
      const c = [p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)];
      sum +=
        a[0] * (b[1] * c[2] - b[2] * c[1]) +
        a[1] * (b[2] * c[0] - b[0] * c[2]) +
        a[2] * (b[0] * c[1] - b[1] * c[0]);
    }
    return Math.abs(sum / 6);
  };
  const withoutNotch = geometryForModel(
    beam,
    batch.filter((o) => o !== notch),
  );
  const removed = volume(withoutNotch) - volume(geometry);
  // Analytic IPE 300 top-80-mm area, allowing for the library's discretised root radii.
  const expected = 200 * (150 * 10.7 + 7.1 * (80 - 10.7) + 2 * 15 ** 2 * (1 - Math.PI / 4));
  assert.ok(Math.abs(removed - expected) / expected < 0.005, `Notch volume ${removed}`);

  const project = createProject({ grid: defaultGrid, levels: initialLevels() });
  const before = structuredClone(project);
  const history = new ProjectHistory();
  const editor = createModelEditor({ project, checkpoint: () => history.checkpoint(project) });
  editor.add(batch);
  const saved = parseProjectFile(serializeProject(project));
  assert.deepEqual(
    saved.objects.filter((o) => o.modelImport),
    project.objects.filter((o) => o.modelImport),
  );
  const column = bySource(project.objects, 'P01');
  editor.update([{ ...column, start: [20, 0, 0], end: [20, 0, 3600] }]);
  assert.ok(Math.abs(lineCutFrame(bySource(project.objects, 'F01').cuts[0]).origin.x - 120) < 1e-6);
  Object.assign(project, history.undo(project));
  Object.assign(project, history.undo(project));
  assert.deepEqual(project, before);
  Object.assign(project, history.redo(project));
  assert.equal(project.objects.filter((o) => o.modelImport).length, 6);
});
test('v2 operations reject missing or wrong references; excluded members block dependent operations', () => {
  const data = operations();
  const rows = planModelImport(data, libraries);
  const selected = new Set(rows.map((r) => r.id));
  selected.delete('P01');
  assert.match(modelImportSelectionIssues(rows, selected).get('F01'), /P01/);
  assert.throws(() => modelImportObjects(data, rows, selected, new Set(), []), /P01/);
  selected.delete('F01');
  assert.equal(modelImportSelectionIssues(rows, selected).size, 0);
  assert.equal(modelImportObjects(data, rows, selected, new Set(), []).length, 4);
  const broken = operations();
  broken.objects[3].references = ['C01', 'B01'];
  broken.objects[4].references = ['missing', 'B01'];
  broken.objects[5].targets = ['C01'];
  const bad = planModelImport(broken, libraries);
  assert.ok(bad.slice(3).every((r) => r.error));
  assert.ok(bad.slice(0, 3).every((r) => !r.error));
  broken.version = 1;
  assert.ok(
    planModelImport(broken, libraries)
      .slice(3)
      .every((r) => r.error.includes('version 2')),
  );
});
test('v2 line cuts use the existing plane convention and reject malformed or self-targeting tools', () => {
  const data = operations();
  data.objects.push({
    id: 'L01',
    type: 'linecut',
    name: 'Plan skärning',
    targets: ['B01'],
    frame: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 0, 1] },
    polygon: [
      [0, 3340],
      [6000, 3340],
    ],
    side: 'negative',
    source: { file: 'test.pdf' },
  });
  const rows = planModelImport(data, libraries);
  assert.equal(rows.at(-1).error, '');
  assert.equal(rows.at(-1).object.type, 'linecut');
  assert.deepEqual(lineCutFrame(rows.at(-1).object).n.toArray(), [0, 0, -1]);
  data.objects.at(-1).frame.u = [2, 0, 0];
  assert.match(planModelImport(data, libraries).at(-1).error, /arbetsplan/);
  data.objects.at(-1).targets = ['L01'];
  assert.match(planModelImport(data, libraries).at(-1).error, /referenser/);
});

test('v2 miter delegates both end cuts to native Fit and rejects parallel members', () => {
  const data = operations();
  data.objects[3].mode = 'miter';
  let rows = planModelImport(data, libraries);
  assert.equal(rows[3].error, '');
  assert.equal(rows[3].object.cuts.length, 2);
  assert.deepEqual(
    new Set(rows[3].object.targets),
    new Set([rows[0].object.id, rows[2].object.id]),
  );
  data.objects[2].start = [0, 0, 0];
  data.objects[2].end = [0, 0, 3500];
  rows = planModelImport(data, libraries);
  assert.match(rows[3].error, /olika riktningar/);
});
