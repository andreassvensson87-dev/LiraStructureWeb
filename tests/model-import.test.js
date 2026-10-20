import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseModelImport,
  planModelImport,
  modelImportObjects,
} from '../src/project/model-import.js';
import { BUILTIN_PROFILES } from '../src/profile-catalog.js';
import { BUILTIN_MATERIALS } from '../src/material-catalog.js';
import { createModelEditor } from '../src/app/model-editor.js';
import { createProject } from '../src/project/project-state.js';
import { ProjectHistory } from '../src/project/project-history.js';
import { initialLevels } from '../src/levels.js';
import { defaultGrid } from '../src/grid-lines.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
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
    ['version', 2],
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
