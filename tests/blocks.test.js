import {
  withPointBindings,
  pointBindingStates,
  pointBindingGuides,
} from '../src/blocks/point-bindings.js';
import { defaultNumberingSettings } from '../src/numbering/plan.js';
import { readFileSync } from 'node:fs';
import { assemblyGeometry } from '../src/assembly-geometry.js';
import { objectType } from '../src/model/object-types/index.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  modelBlockDefinition,
  modelBlockMembers,
  updateModelBlock,
} from '../src/blocks/model-adapter.js';
import {
  drawingBlockDefinition,
  drawingBlockMembers,
  updateDrawingBlock,
} from '../src/blocks/drawing-adapter.js';
import { blockValues, evaluateBlock } from '../src/blocks/definition.js';
import { BlockSession } from '../src/blocks/session.js';
import { blockSelection, blockPlacementAt, blockPoint } from '../src/blocks/placement.js';
import {
  blockGripValues,
  blockPropertyGripValues,
  blockRadiusGripValues,
} from '../src/blocks/grip.js';
import { nextBlockVersion, mergeBlockLibrary } from '../src/blocks/library-data.js';
import { validateBlockInstances } from '../src/blocks/validation.js';
import { createModelEditor } from '../src/app/model-editor.js';
import { createProject } from '../src/project/project-state.js';
import { ProjectHistory } from '../src/project/project-history.js';
import { initialLevels } from '../src/levels.js';
import { defaultGrid } from '../src/grid-lines.js';
import { transformObject } from '../src/transform.js';
import { rotateObject } from '../src/rotation.js';
import { translatedShapes, rotatedShapes } from '../src/drawing-object-transform.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
import { numberParts } from '../src/part-marks.js';
import { plateNormal, plateVertices } from '../src/plate.js';
import { DrawingBlocks } from '../src/blocks/drawing-controller.js';
function fixture() {
  const project = createProject({ grid: defaultGrid, levels: initialLevels() }),
    history = new ProjectHistory();
  const source = [0, 1].map((i) => ({
    id: `beam${i}`,
    type: 'sweep',
    name: 'Balk',
    prefix: 'B',
    number: i + 1,
    profile: 'rect',
    width: 100,
    height: 200,
    thickness: 0,
    rotation: 0,
    start: [0, i * 500, 0],
    end: [3000, i * 500, 0],
    partSeries: { prefix: 'P', start: 100 },
    assemblySeries: { prefix: 'A', start: 1000 },
  }));
  project.objects = source;
  const { definition, placement } = modelBlockDefinition(source, 'Testblock');
  const members = modelBlockMembers(
    definition,
    {},
    placement,
    'instance',
    source.map((o) => ({ ...o, parametricBlock: { memberId: o.id } })),
  );
  let checkpoints = 0;
  const editor = createModelEditor({
    project,
    checkpoint: () => {
      history.checkpoint(project);
      checkpoints++;
    },
  });
  editor.update(members);
  return { project, history, definition, members, editor, count: () => checkpoints };
}
test('block expressions reject cycles, duplicate locks and invalid geometry without altering definition history', () => {
  assert.equal(
    blockValues([
      { name: 'B', unit: 'mm', value: 'H*2' },
      { name: 'H', unit: 'mm', value: 50 },
    ]).B,
    100,
  );
  assert.throws(
    () =>
      blockValues([
        { name: 'B', unit: 'mm', value: 'H' },
        { name: 'H', unit: 'mm', value: 'B' },
      ]),
    /Cirkulärt/,
  );
  const f = fixture(),
    session = new BlockSession(f.definition, (result, definition) =>
      modelBlockMembers(definition, result.values),
    );
  const before = structuredClone(session.definition);
  assert.throws(
    () => session.change((d) => d.bindings.push({ ...d.bindings[0] })),
    /flera låsningar/,
  );
  assert.deepEqual(session.definition, before);
  assert.equal(session.past.length, 0);
  assert.throws(() => session.test({ B: 0 }), /gränser/);
  assert.deepEqual(session.values, {});
  session.change((d) => (d.name = 'Ny'));
  assert.equal(session.undo().members.length, 2);
  assert.equal(session.definition.name, 'Testblock');
  session.undo(true);
  assert.equal(session.definition.name, 'Ny');
});
test('3D parameter updates keep real part identities, numbering series and one undo transaction', () => {
  const f = fixture(),
    before = structuredClone(f.project);
  const next = updateModelBlock(f.members, { B: 5000, H: 2000 });
  assert.deepEqual(
    next.map((o) => o.id),
    f.members.map((o) => o.id),
  );
  f.editor.update(next);
  assert.equal(f.count(), 2);
  assert.deepEqual(
    f.project.objects.map((o) => o.partSeries),
    before.objects.map((o) => o.partSeries),
  );
  Object.assign(f.project, f.history.undo(f.project));
  assert.deepEqual(f.project, before);
  Object.assign(f.project, f.history.redo(f.project));
  assert.deepEqual(f.project.objects, next);
  assert.equal(numberParts(f.project.objects).assignments[next[0].id].mark.length > 0, true);
});
test('native move, rotation and copy preserve the block frame and keep copies independently parametric', () => {
  const f = fixture();
  const moved = f.members.map((o) => transformObject(o, 'move', [0, 0, 0], [500, 600, 700]));
  f.editor.update(moved);
  const rotated = moved.map((o) => rotateObject(o, [500, 600, 700], 'Y', 40));
  f.editor.update(rotated);
  const copies = f.editor.update(
    rotated.map((o) => transformObject(o, 'copy', [0, 0, 0], [2000, 0, 0])),
    { copy: true },
  );
  const created = copies.objects.filter((o) => copies.ids.includes(o.id));
  assert.notEqual(created[0].parametricBlock.instanceId, rotated[0].parametricBlock.instanceId);
  assert.equal(new Set(created.map((o) => o.parametricBlock.instanceId)).size, 1);
  f.editor.update(updateModelBlock(created, { B: 9000 }));
  assert.equal(
    f.project.objects.find((o) => o.id === rotated[0].id).parametricBlock.values.B,
    undefined,
  );
  const count = f.count(),
    before = structuredClone(f.project);
  assert.throws(() => f.editor.update([{ ...rotated[0], end: [1, 2, 3] }]), /styr/);
  assert.equal(f.count(), count);
  assert.deepEqual(f.project, before);
});
test('block versions are explicit and project files retain snapshots without a library', () => {
  const f = fixture(),
    first = nextBlockVersion({ schema: 1, definitions: [] }, f.definition),
    second = nextBlockVersion(first.library, { ...f.definition, name: 'Version 2' });
  assert.equal(second.definition.revision, 2);
  assert.equal(f.members[0].parametricBlock.definition.revision, 1);
  assert.equal(mergeBlockLibrary(first.library, first.library).definitions.length, 1);
  assert.throws(
    () =>
      mergeBlockLibrary(first.library, {
        schema: 1,
        definitions: [{ ...first.definition, name: 'Motstridig version' }],
      }),
    /annat innehåll/,
  );
  assert.equal(first.library.definitions.length, 1);
  const restored = parseProjectFile(serializeProject(f.project));
  assert.deepEqual(restored.objects, f.project.objects);
  assert.throws(() => f.editor.replace(f.project.objects.slice(1)), /saknar delar/);
});
test('plates retain their material side, support collinear contour points and validate thickness and planarity before history', () => {
  const plate = {
    id: 'plate',
    type: 'plate',
    name: 'Plåt',
    prefix: 'PL',
    number: 1,
    frame: { origin: [10, 20, 30], u: [1, 0, 0], v: [0, 1, 0] },
    polygon: [
      [0, 0],
      [0, 100],
      [0, 200],
      [300, 200],
      [300, 0],
    ],
    thickness: 10,
    side: 'positive',
    material: { id: 'steel', version: 1 },
  };
  const { definition, placement } = modelBlockDefinition([plate]);
  definition.parameters.push({ name: 'T', value: 10, unit: 'mm', min: 1, max: 100 });
  definition.properties.push({ memberId: 'plate', key: 'thickness', value: 'T' });
  const members = modelBlockMembers(definition, {}, placement, 'plate-block');
  assert.ok(plateNormal(members[0]).dot(plateNormal(plate)) > 0.999);
  assert.deepEqual(plateVertices(members[0]), plateVertices(plate));
  const changed = updateModelBlock(members, { B: 600, D: 400, T: 20 });
  assert.equal(changed[0].thickness, 20);
  assert.deepEqual(changed[0].material, plate.material);
  const rotated = changed.map((o) => rotateObject(o, [0, 0, 0], 'X', 35));
  validateBlockInstances(rotated, 3, updateModelBlock);
  const session = new BlockSession(definition, (result, d) => modelBlockMembers(d, result.values));
  assert.throws(() => session.test({ T: 0 }), /gränser/);
  assert.equal(session.past.length, 0);
  assert.throws(() => session.change((d) => (d.members[0].points[2][2] += 50)), /samma plan/);
  assert.deepEqual(session.definition, definition);
  assert.equal(blockPropertyGripValues(members[0].parametricBlock, 'plate', 'thickness', 25).T, 25);
});
test('a parameter-bound insertion anchor remains fixed for oblique 3D placement and instance updates', () => {
  const f = fixture(),
    definition = structuredClone(f.definition);
  definition.anchors.push({ id: 'right', name: 'Höger', point: [3000, 0, 0] });
  definition.bindings.push({ memberId: 'right', pointIndex: 0, referenceId: 'end-0', offset: '0' });
  const start = [1000, 2000, 3000],
    placement = blockPlacementAt(evaluateBlock(definition), 'right', start, [1200, 2300, 3400]),
    members = modelBlockMembers(definition, {}, placement, 'anchored', [], 'right');
  validateBlockInstances(members, 3, updateModelBlock);
  const changed = updateModelBlock(members, { B: 6000 });
  const anchor = evaluateBlock(definition, { B: 6000 }).anchors.find((a) => a.id === 'right');
  const world = blockPoint(changed[0].parametricBlock.placement, anchor.point);
  assert.ok(world.every((v, i) => Math.abs(v - start[i]) < 1e-6));
  assert.ok(
    Math.abs(Math.hypot(...changed[0].end.map((v, i) => v - changed[0].start[i])) - 6000) < 1e-6,
  );
  validateBlockInstances(changed, 3, updateModelBlock);
  const target = blockPoint(changed[0].parametricBlock.placement, [-1000, 0, 0]);
  const gripValues = blockGripValues(changed[0].parametricBlock, 'beam0', 0, target);
  assert.ok(Math.abs(gripValues.B - 7000) < 1e-6);
  const stretched = updateModelBlock(changed, gripValues);
  assert.ok(stretched[0].start.every((v, i) => Math.abs(v - target[i]) < 1e-6));
  assert.ok(stretched[0].end.every((v, i) => Math.abs(v - start[i]) < 1e-6));
  assert.throws(
    () =>
      blockGripValues(
        changed[0].parametricBlock,
        'beam0',
        1,
        blockPoint(changed[0].parametricBlock.placement, [6500, 0, 0]),
      ),
    /fasta referenser/,
  );
});
test('paper blocks commit atomically, preserve their dimensions across project files and reject incomplete instances', () => {
  const { definition, placement } = drawingBlockDefinition([
    {
      id: 'one',
      type: 'shape',
      shape: 'line',
      view: 'paper',
      points: [
        [10, 20],
        [40, 20],
      ],
    },
    {
      id: 'two',
      type: 'shape',
      shape: 'line',
      view: 'paper',
      points: [
        [10, 20],
        [10, 40],
      ],
    },
  ]);
  const members = drawingBlockMembers(definition, {}, placement, 'paper', 'paper-block'),
    project = createProject({ grid: defaultGrid, levels: initialLevels() });
  project.drawings = [{ id: 'drawing', type: 'GA', number: 'GA-001', annotations: members }];
  const restored = parseProjectFile(serializeProject(project));
  assert.deepEqual(restored.drawings[0].annotations, members);
  let checkpoints = 0;
  const editor = {
      record: { annotations: members },
      items: members,
      checkpoint: () => checkpoints++,
      cancel() {},
    },
    controller = { editor, preview: null, prepare: DrawingBlocks.prototype.prepare };
  const confirm = controller.prepare(updateDrawingBlock(members, { B: 50 }));
  assert.equal(checkpoints, 0);
  assert.equal(editor.items, members);
  confirm();
  assert.equal(checkpoints, 1);
  assert.equal(editor.items[0].points[1][0] - editor.items[0].points[0][0], 50);
  const before = editor.items;
  assert.throws(
    () =>
      DrawingBlocks.prototype.commit.call(controller, [
        {
          ...before[0],
          points: [
            [0, 0],
            [1, 1],
          ],
        },
      ]),
    /styr/,
  );
  assert.equal(checkpoints, 1);
  assert.equal(editor.items, before);
  const corrupt = structuredClone(project);
  corrupt.drawings[0].annotations.pop();
  assert.throws(() => parseProjectFile(serializeProject(corrupt)), /saknar delar/);
});
test('2D blocks use native shapes, scale-independent model coordinates, whole-block transformations and parameter grips', () => {
  const items = [
    {
      id: 'a',
      type: 'shape',
      shape: 'rectangle',
      view: 'front',
      points: [
        [10, 20],
        [110, 70],
      ],
      hatch: { pattern: 'none' },
    },
    {
      id: 'b',
      type: 'shape',
      shape: 'line',
      view: 'front',
      points: [
        [10, 20],
        [110, 20],
      ],
    },
  ];
  const { definition, placement } = drawingBlockDefinition(items),
    members = drawingBlockMembers(definition, {}, placement, 'front', '2d');
  assert.equal(members[0].shape, 'polyline');
  assert.equal(members[0].closed, true);
  const changed = updateDrawingBlock(members, { B: 200, H: 100 });
  assert.deepEqual(changed[0].points[2], [210, 120]);
  const moved = translatedShapes(changed, [changed[0].id], [0, 0], [50, 30]);
  assert.equal(moved.length, 2);
  validateBlockInstances(moved, 2, updateDrawingBlock);
  const rotated = rotatedShapes(moved, [moved[0].id], [0, 0], Math.PI / 3);
  validateBlockInstances(rotated, 2, updateDrawingBlock);
  const copy = translatedShapes(rotated, [rotated[0].id], [0, 0], [100, 0], true);
  assert.notEqual(copy[0].parametricBlock.instanceId, rotated[0].parametricBlock.instanceId);
  assert.equal(blockSelection(members, [members[0].id]).size, 2);
  const values = blockGripValues(members[0].parametricBlock, 'a', 2, [310, 170]);
  assert.equal(values.B, 300);
  assert.equal(values.H, 150);
  assert.throws(() => drawingBlockMembers(definition, {}, placement, 'paper'), /Pappersblock/);
  const circle = drawingBlockDefinition([
    {
      id: 'circle',
      type: 'shape',
      shape: 'circle',
      view: 'front',
      points: [
        [20, 30],
        [120, 30],
      ],
    },
  ]);
  const [round] = drawingBlockMembers(circle.definition, {}, circle.placement, 'front', 'round');
  const radiusValues = blockRadiusGripValues(
    round.parametricBlock,
    'circle',
    round.points[0],
    round.points[1],
    [20, 180],
  );
  assert.equal(radiusValues.B, 150);
  const [resized] = updateDrawingBlock([round], radiusValues);
  assert.deepEqual(resized.points, [
    [20, 30],
    [170, 30],
  ]);
});

test('the example steel frame and drawing detail follow dimensions, native snap, material, numbering and assembly drawing geometry', () => {
  const library = JSON.parse(
    readFileSync(new URL('../examples/parametric-blocks.json', import.meta.url), 'utf8'),
  );
  const [frame, detail] = library.definitions;
  const original = modelBlockMembers(frame, {}, undefined, 'frame');
  const changed = updateModelBlock(original, { B: 4200, H: 2800, D: 500, T: 16 });
  assert.deepEqual(changed[1].start, [4200, 0, 0]);
  assert.deepEqual(changed[1].end, [4200, 0, 2800]);
  assert.deepEqual(changed[2].end, [4200, 0, 2800]);
  assert.equal(changed[3].thickness, 16);
  assert.deepEqual(changed[3].material, original[3].material);
  assert.deepEqual(objectType(changed[2]).snapSegments(changed[2]).segments, [
    [changed[2].start, changed[2].end],
  ]);
  assert.deepEqual(
    changed[0].parametricBlock.placement.origin,
    original[0].parametricBlock.placement.origin,
  );
  const marks = numberParts(changed, undefined, {}, defaultNumberingSettings()).assignments;
  assert.equal(marks[changed[0].id].mark, marks[changed[1].id].mark);
  assert.match(marks[changed[3].id].mark, /^PL/);
  const assembly = {
    id: 'frame-assembly',
    mainId: changed[0].id,
    memberIds: changed.map((o) => o.id),
  };
  const drawing = assemblyGeometry(assembly, changed);
  assert.equal(drawing.entries.length, 4);
  assert.ok(drawing.geometry.attributes.position.count > 0);
  assert.ok(drawing.snapGeometry.attributes.position.count > 0);
  for (const entry of [drawing, ...drawing.entries]) {
    entry.geometry.dispose();
    entry.snapGeometry.dispose();
  }
  const shapes = updateDrawingBlock(drawingBlockMembers(detail, {}, undefined, 'front', 'detail'), {
    B: 4200,
    H: 2800,
    T: 16,
  });
  assert.deepEqual(shapes[0].points[2], [4200, 2800]);
  assert.deepEqual(shapes[1].points, [
    [0, 16],
    [4200, 16],
  ]);
  const rotated = changed.map((o) => rotateObject(o, [0, 0, 0], 'Z', 30));
  validateBlockInstances(rotated, 3, updateModelBlock);
});

test('batch point binding changes only the reference axis in one undo step and rejects invalid groups atomically', () => {
  const f = fixture(),
    session = new BlockSession(f.definition, (result, d) => modelBlockMembers(d, result.values));
  const keys = ['beam0:1', 'beam1:1'],
    before = structuredClone(session.definition);
  session.change((d) =>
    Object.assign(
      d,
      withPointBindings(d, [...keys, keys[0]], { referenceId: 'end-0', offset: '-100' }),
    ),
  );
  assert.equal(session.past.length, 1);
  assert.deepEqual(
    session.evaluate().members.map((m) => m.points[1]),
    [
      [2900, 0, 0],
      [2900, 500, 0],
    ],
  );
  assert.equal(session.definition.bindings.filter((b) => b.referenceId === 'end-0').length, 2);
  assert.equal(pointBindingStates(session.definition, keys)[1].mixed, true);
  const changed = structuredClone(session.definition);
  assert.throws(
    () =>
      session.change((d) =>
        Object.assign(d, withPointBindings(d, keys, { referenceId: 'end-0', offset: 'UNKNOWN' })),
      ),
    /Okänd/,
  );
  assert.throws(
    () => withPointBindings(changed, [...keys, 'missing:0'], { referenceId: 'end-0' }),
    /giltiga blockpunkter/,
  );
  assert.deepEqual(session.definition, changed);
  assert.equal(session.past.length, 1);
  session.undo();
  assert.deepEqual(session.definition, before);
  session.undo(true);
  assert.deepEqual(session.definition, changed);
  const library = JSON.parse(
    readFileSync(new URL('../examples/parametric-blocks.json', import.meta.url), 'utf8'),
  );
  const plateSession = new BlockSession(library.definitions[0], (result, d) =>
    modelBlockMembers(d, result.values),
  );
  assert.throws(
    () =>
      plateSession.change((d) =>
        Object.assign(
          d,
          withPointBindings(d, ['Bottenplåt:0'], { referenceId: 'base-2', offset: 50 }),
        ),
      ),
    /samma plan/,
  );
  assert.equal(plateSession.past.length, 0);
  assert.deepEqual(plateSession.definition, library.definitions[0]);
});
test('releasing a point axis freezes its evaluated coordinate, keeps other bindings and reports real offset guides', () => {
  const f = fixture(),
    keys = ['beam0:1', 'beam1:1', 'P1:0'],
    original = structuredClone(f.definition);
  const bound = withPointBindings(f.definition, keys, { referenceId: 'end-0', offset: '-B/10' });
  const result = evaluateBlock(bound, { B: 5000 });
  const guides = pointBindingGuides(bound, result, keys, 'end-0');
  assert.equal(guides.length, 3);
  for (const guide of guides) {
    assert.equal(guide.offset, -500);
    assert.equal(guide.to[0], 5000);
    assert.equal(guide.from[0], 4500);
  }
  const released = withPointBindings(bound, keys, { axis: 0 }, { B: 5000 });
  assert.deepEqual(
    evaluateBlock(released, { B: 6000 }).members.map((m) => m.points[1][0]),
    [4500, 4500],
  );
  assert.equal(evaluateBlock(released).anchors[0].point[0], 4500);
  assert.equal(pointBindingStates(released, keys)[0].referenceId, '');
  assert.deepEqual(
    released.bindings,
    bound.bindings.filter(
      (b) =>
        !keys.includes(`${b.memberId}:${b.pointIndex}`) ||
        bound.references.find((r) => r.id === b.referenceId).axis !== 0,
    ),
  );
  assert.deepEqual(f.definition, original);
  const zero = withPointBindings(f.definition, ['beam0:1'], { referenceId: 'end-0', offset: 0 });
  const [guide] = pointBindingGuides(zero, evaluateBlock(zero), ['beam0:1'], 'end-0');
  assert.deepEqual(guide.from, guide.to);
});
