import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAssemblySchedule, assemblyScheduleTable } from '../src/assembly-schedule.js';
import { createProject } from '../src/project/project-state.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
import {
  createAssembly,
  createAssemblyDrawing,
  assemblySchedule,
} from '../src/project/assemblies.js';
import { numberParts } from '../src/part-marks.js';
import { mergeDrawingEdit } from '../src/project/drawing-edits.js';
import { ProjectHistory } from '../src/project/project-history.js';
const rows = [
  { key: 'one', mark: 'B-002', name: 'Balk', material: 'Stål', quantity: 2 },
  { key: 'two', mark: 'B-010', name: 'Pelare', material: 'Trä', quantity: 1 },
];
test('older schedules retain defaults and detached settings drafts', () => {
  const source = { position: [20, 30], visible: false };
  const draft = normalizeAssemblySchedule(source);
  assert.equal(draft.visible, false);
  assert.deepEqual(
    draft.columns.map((c) => c.width),
    [30, 65, 45, 20],
  );
  draft.position[0] = 100;
  assert.equal(source.position[0], 20);
  assert.equal(
    normalizeAssemblySchedule({ textSize: -10, columns: [{ id: 'mark', width: Infinity }] })
      .textSize,
    2.8,
  );
});
test('custom cells, column order/visibility/width and text size affect the rendered table', () => {
  const settings = {
    columns: [
      { id: 'custom-note', title: 'Kommentar', width: 50 },
      { id: 'quantity', title: 'Antal', width: 20 },
      { id: 'mark', title: 'Detalj', width: 30, visible: false },
    ],
    textSize: 5,
    cells: { one: { 'custom-note': 'Svetsas' } },
  };
  const data = assemblyScheduleTable(rows, settings);
  assert.deepEqual(data.values, [
    ['Kommentar', 'Antal'],
    ['Svetsas', '2'],
    ['', '1'],
  ]);
  assert.equal(data.width, 70);
  assert.equal(data.rowHeight, 11);
});
test('mark and quantity cannot be overridden; editable text sorting uses displayed values', () => {
  const cells = {
    one: { mark: 'Wrong', quantity: 99, name: 'Z', material: 'Ändrad' },
    two: { name: 'A' },
  };
  const data = assemblyScheduleTable(rows, { cells, sort: 'name' });
  assert.deepEqual(
    data.rows.map((r) => r.key),
    ['two', 'one'],
  );
  assert.deepEqual(data.values[2], ['B-002', 'Z', 'Ändrad', '2']);
  assert.deepEqual(
    assemblyScheduleTable(rows, { sort: 'quantity', descending: true }).rows.map((r) => r.quantity),
    [2, 1],
  );
  assert.deepEqual(rows[0], {
    key: 'one',
    mark: 'B-002',
    name: 'Balk',
    material: 'Stål',
    quantity: 2,
  });
});
test('manufacturing-key cell edits survive numbering and file/history but do not leak onto changed parts', () => {
  let state = createProject({
    grid: { x: [0, 1000], y: [0, 1000] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  const beam = (id, y) => ({
    id,
    name: id,
    type: 'sweep',
    profile: 'rect',
    width: 100,
    height: 200,
    thickness: 10,
    rotation: 0,
    start: [0, y, 0],
    end: [1000, y, 0],
  });
  state.objects = [beam('a', 0), beam('b', 300)];
  state.parts = numberParts(state.objects);
  state.assemblies = [createAssembly(state, ['a', 'b'], 'a', 'Par', () => 'assembly')];
  state.drawings = [createAssemblyDrawing(state, 'assembly', {}, () => 'drawing')];
  const key = assemblySchedule(state.assemblies[0], state)[0].key;
  const edit = structuredClone(state.drawings[0]);
  edit.sheet = {
    assemblySchedule: normalizeAssemblySchedule({
      style: 'material',
      notes: { execution: 'EXC3' },
      cells: { [key]: { name: 'Tillverkningsnotering' } },
      textSize: 4,
    }),
  };
  const history = new ProjectHistory();
  history.checkpoint(state);
  state.drawings = mergeDrawingEdit(state.drawings, edit);
  const loaded = parseProjectFile(serializeProject(state));
  assert.equal(loaded.drawings[0].sheet.assemblySchedule.cells[key].name, 'Tillverkningsnotering');
  assert.equal(loaded.drawings[0].sheet.assemblySchedule.style, 'material');
  assert.equal(loaded.drawings[0].sheet.assemblySchedule.notes.execution, 'EXC3');
  const settings = state.drawings[0].sheet.assemblySchedule;
  state.objects[1].width = 150;
  state.parts = numberParts(state.objects, state.parts);
  const changed = assemblyScheduleTable(assemblySchedule(state.assemblies[0], state), settings);
  assert.equal(changed.values.filter((r) => r.includes('Tillverkningsnotering')).length, 1);
  state = history.undo(state);
  assert.equal(state.drawings[0].sheet, undefined);
  state = history.redo(state);
  assert.equal(state.drawings[0].sheet.assemblySchedule.textSize, 4);
});

test('reference material list uses six DXF columns and protects derived dimensions and weight', () => {
  const data = assemblyScheduleTable(
    [
      {
        key: 'a',
        mark: 'B-001',
        name: 'RHS',
        material: 'S355',
        quantity: 2,
        length: 1234.4,
        weight: 15.76,
      },
      {
        key: 'b',
        mark: 'B-002',
        name: 'PL',
        material: '—',
        quantity: 1,
        length: 150,
        weight: null,
      },
    ],
    { style: 'material', cells: { a: { length: 9, weight: 999 } } },
  );
  assert.equal(data.width, 110);
  assert.equal(data.rowHeight, 3.5);
  assert.deepEqual(data.values[1], ['B-001', 'RHS', 'S355', '2', '1234', '15,8']);
  assert.equal(data.values[2][5], '—');
  assert.equal(data.totalWeight, null);
  const normalized = normalizeAssemblySchedule({ style: 'material', notes: { execution: 'EXC2' } });
  assert.equal(normalized.notes.execution, 'EXC2');
  assert.equal(normalized.notes.weldInstructions, '');
});

test('assembly mass is summed per row and per element, independent of instance quantity', () => {
  const beam = (id, y) => ({
    id,
    type: 'sweep',
    profile: 'rect',
    width: 100,
    height: 200,
    start: [0, y, 0],
    end: [1000, y, 0],
    material: { name: 'S355', density: 7850 },
  });
  const objects = [beam('a', 0), beam('b', 300)];
  const state = { objects, parts: numberParts(objects) };
  const rows = assemblySchedule({ memberIds: ['a', 'b'] }, state);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].quantity, 2);
  assert.equal(rows[0].length, 1000);
  assert.equal(rows[0].weight, 314);
  assert.equal(assemblyScheduleTable(rows, { style: 'material' }).totalWeight, 314);
});

test('assemblies with one or twenty members derive only their own list and round-trip', () => {
  for (const count of [1, 20]) {
    const state = createProject({
      grid: { x: [0, 1000], y: [0, 1000] },
      levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
    });
    state.objects = Array.from({ length: count + 1 }, (_, i) => ({
      id: `b${i}`,
      type: 'sweep',
      profile: 'rect',
      width: 100,
      height: 200,
      thickness: 0,
      rotation: 0,
      start: [0, i * 300, 0],
      end: [1000 + i * 10, i * 300, 0],
      material: { name: 'S355', density: 7850 },
    }));
    state.parts = numberParts(state.objects);
    const ids = state.objects.slice(0, count).map((o) => o.id);
    const assembly = createAssembly(state, ids, ids[0], 'Test', () => 'assembly');
    state.assemblies = [assembly];
    state.drawings = [createAssemblyDrawing(state, assembly.id, {}, () => 'drawing')];
    const loaded = parseProjectFile(serializeProject(state));
    const list = assemblySchedule(loaded.assemblies[0], loaded);
    assert.equal(list.length, count);
    assert.equal(
      list.reduce((n, row) => n + row.quantity, 0),
      count,
    );
    assert.equal(
      list.some((row) => row.length === 1000 + count * 10),
      false,
    );
  }
});
