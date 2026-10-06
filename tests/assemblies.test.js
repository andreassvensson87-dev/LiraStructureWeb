import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createProject } from '../src/project/project-state.js';
import { ProjectHistory } from '../src/project/project-history.js';
import { serializeProject, parseProjectFile } from '../src/project/project-file.js';
import {
  createAssembly,
  addToAssembly,
  createAssemblyDrawing,
  assemblySchedule,
  assemblyValid,
  removeAssembly,
  updateAssembly,
  syncAssemblyDrawingIdentity,
} from '../src/project/assemblies.js';
import { numberParts } from '../src/part-marks.js';
import { drawingStamp } from '../src/drawing-manager.js';
import { assemblyGeometry } from '../src/assembly-geometry.js';
import { sectionVectors } from '../src/drawing-sections.js';
import { partViewFrame } from '../src/part-view-frame.js';
import { mergeDrawingEdit } from '../src/project/drawing-edits.js';
import { assemblyDrawingMatrix } from '../src/assembly-frames.js';
import { frameMatrix } from '../src/drawing-sections.js';
import { referenceCandidates, resolveReference } from '../src/annotation-references.js';
import {
  builtInAttributes,
  updateDrawingAttribute,
  drawingAttributeContext,
} from '../src/drawing-attributes.js';

const beam = (id, y = 0) => ({
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
function fixture() {
  const state = createProject({
    grid: { x: [0, 1000], y: [0, 1000] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  state.objects = [beam('a'), beam('b', 300), beam('c', 600)];
  state.parts = numberParts(state.objects);
  state.assemblies = [createAssembly(state, ['a', 'b'], 'a', 'Balkpar', () => 'assembly')];
  state.drawings = [createAssemblyDrawing(state, 'assembly', {}, () => 'drawing')];
  return state;
}
test('selected secondaries create an assembly with the clicked main and can extend an existing group', () => {
  const state = fixture();
  state.assemblies = [];
  state.drawings = [];
  const result = addToAssembly(state, ['b', 'b'], 'a');
  assert.equal(result.assemblies[0].mainId, 'a');
  assert.deepEqual(result.assemblies[0].memberIds, ['b', 'a']);
  assert.equal(state.assemblies.length, 0);
  const next = addToAssembly({ ...state, ...result }, ['c'], 'a');
  assert.equal(next.assemblies.length, 1);
  assert.deepEqual(next.assemblies[0].memberIds, ['b', 'a', 'c']);
  assert.deepEqual(result.assemblies[0].memberIds, ['b', 'a']);
});
test('assembly picks reject selected mains, nonphysical parts and members of other assemblies', () => {
  const state = fixture();
  assert.throws(() => addToAssembly(state, [], 'c'), /sekundärdel/);
  assert.throws(() => addToAssembly(state, ['c'], 'c'), /utanför/);
  assert.throws(() => addToAssembly(state, ['c'], 'b'), /huvuddelen/);
  assert.throws(() => addToAssembly(state, ['b'], 'c'), /redan/);
  assert.throws(() => addToAssembly(state, ['c'], 'missing'), /fysiska/);
});
test('assembly membership validates physical members, overlap and main part without mutating selection', () => {
  const state = fixture(),
    ids = ['b', 'c', 'c'];
  assert.throws(() => createAssembly(state, ids, 'b'), /redan/);
  assert.deepEqual(ids, ['b', 'c', 'c']);
  assert.throws(() => createAssembly(state, ['c'], 'c'), /minst två/);
  assert.throws(() => createAssembly({ ...state, assemblies: [] }, ['b', 'c'], 'a'), /Huvuddelen/);
  assert.throws(
    () => createAssembly({ ...state, assemblies: [] }, ['b', 'missing'], 'b'),
    /fysiska/,
  );
  assert.equal(
    createAssembly({ ...state, assemblies: [] }, ['b', 'c', 'c'], 'b').memberIds.length,
    2,
  );
  assert.equal(createAssemblyDrawing({ ...state, drawings: [] }, 'assembly', {}).type, 'AS');
  assert.throws(() => createAssemblyDrawing(state, 'assembly', {}), /redan/);
});
test('stycklista counts only assembly members, groups equal parts and flags stale numbering', () => {
  const state = fixture();
  const rows = assemblySchedule(state.assemblies[0], state);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].quantity, 2);
  assert.equal(rows[0].mark, state.parts.assignments.a.mark);
  state.objects[1].width = 150;
  assert.equal(
    assemblySchedule(state.assemblies[0], state).find((r) => r.mark === 'Ej numrerad').quantity,
    1,
  );
  assert.throws(() => createAssemblyDrawing({ ...state, drawings: [] }, 'assembly', {}), /Numrera/);
});
test('assembly drawings track members and numbering; unrelated geometry leaves review current', () => {
  const state = fixture(),
    drawing = state.drawings[0],
    before = drawingStamp(drawing, state);
  state.objects[2].width = 170;
  assert.equal(drawingStamp(drawing, state), before);
  state.objects[1].start[1] += 30;
  assert.notEqual(drawingStamp(drawing, state), before);
  state.objects = state.objects.filter((o) => o.id !== 'a');
  assert.equal(drawingStamp(drawing, state), null);
  assert.equal(assemblyValid(state.assemblies[0], state.objects), false);
  assert.throws(() => assemblyGeometry(state.assemblies[0], state.objects), /saknar/);
});
test('project file roundtrip retains assemblies, missing-member status, and supports earlier files', () => {
  const state = fixture(),
    loaded = parseProjectFile(serializeProject(state));
  assert.deepEqual(loaded.assemblies, state.assemblies);
  assert.deepEqual(loaded.drawings, state.drawings);
  const old = JSON.parse(serializeProject(state));
  old.project.drawings = [];
  delete old.project.assemblies;
  assert.deepEqual(parseProjectFile(JSON.stringify(old)).assemblies, []);
  state.objects = state.objects.filter((o) => o.id !== 'a');
  const missing = parseProjectFile(serializeProject(state));
  assert.equal(drawingStamp(missing.drawings[0], missing), null);
});
test('project files reject overlapping memberships and orphan assembly drawings', () => {
  const state = fixture();
  state.assemblies.push({ ...state.assemblies[0], id: 'other', mark: 'A-002' });
  assert.throws(() => serializeProject(state), /assembly/);
  state.assemblies = [];
  assert.throws(() => serializeProject(state), /saknar en assembly/);
});
test('assembly creation and removal undo with drawings while leaving model parts intact', () => {
  let state = fixture();
  const h = new ProjectHistory();
  h.checkpoint(state);
  Object.assign(state, removeAssembly(state, 'assembly'));
  assert.equal(state.objects.length, 3);
  assert.equal(state.drawings.length, 0);
  state = h.undo(state);
  assert.equal(state.assemblies.length, 1);
  assert.equal(state.drawings.length, 1);
  state = h.redo(state);
  assert.equal(state.assemblies.length, 0);
});
test('assembly drawing edits preserve assembly and source identity', () => {
  const state = fixture(),
    edit = { ...state.drawings[0], assemblyId: 'wrong', sourceId: 'wrong', sheet: { views: [] } };
  const next = mergeDrawingEdit(state.drawings, edit);
  assert.equal(next[0].assemblyId, 'assembly');
  assert.equal(next[0].sourceId, 'a');
});
test('assembly geometry uses the main part frame and keeps solids for shared occlusion', () => {
  const state = fixture(),
    data = assemblyGeometry(state.assemblies[0], state.objects);
  try {
    assert.equal(data.entries.length, 2);
    data.geometry.computeBoundingBox();
    assert.equal(data.geometry.boundingBox.getSize(new THREE.Vector3()).x, 1000);
    const frame = partViewFrame('front');
    const vectors = sectionVectors(
      data.entries.map((e) => e.geometry),
      frame,
      null,
    );
    assert.equal(vectors.length, 2);
    assert.ok(vectors.some((v) => v.hidden.length));
    assert.deepEqual(state.objects[0].start, [0, 0, 0]);
  } finally {
    data.geometry.dispose();
    data.snapGeometry.dispose();
    data.entries.forEach((e) => {
      e.geometry.dispose();
      e.snapGeometry.dispose();
    });
  }
});

test('editing membership retains assembly/drawing numbers and annotations and requests review', () => {
  const state = fixture(),
    old = structuredClone(state);
  state.drawings[0].annotations = [
    {
      type: 'dimension',
      view: 'front',
      points: [
        [0, 0],
        [100, 0],
      ],
      references: [{ source: 'b' }],
    },
  ];
  state.drawings[0].reviewed = 'reviewed';
  const next = updateAssembly(state, 'assembly', {
    name: 'Ny grupp',
    mainId: 'a',
    memberIds: ['a', 'c'],
  });
  assert.equal(next.assemblies[0].mark, old.assemblies[0].mark);
  assert.equal(next.drawings[0].id, 'drawing');
  assert.equal(next.drawings[0].number, 'A-001');
  assert.equal(next.drawings[0].name, 'Ny grupp');
  assert.equal(next.drawings[0].needsReview, true);
  assert.equal(next.drawings[0].reviewed, undefined);
  assert.deepEqual(next.drawings[0].annotations, state.drawings[0].annotations);
  next.drawings[0].annotations[0].points[0][0] = 50;
  assert.equal(state.drawings[0].annotations[0].points[0][0], 0);
  assert.deepEqual(state.parts, old.parts);
  assert.deepEqual(state.assemblies, old.assemblies);
});
test('assembly edits reject overlap, missing parts and removing the main part without replacement atomically', () => {
  const state = fixture(),
    before = JSON.stringify(state);
  assert.throws(
    () => updateAssembly(state, 'assembly', { name: 'a', mainId: 'a', memberIds: ['b', 'c'] }),
    /Huvuddelen/,
  );
  assert.throws(
    () => updateAssembly(state, 'assembly', { name: 'a', mainId: 'a', memberIds: ['a'] }),
    /minst två/,
  );
  assert.throws(
    () =>
      updateAssembly(state, 'assembly', { name: 'a', mainId: 'a', memberIds: ['a', 'missing'] }),
    /fysiska/,
  );
  assert.equal(JSON.stringify(state), before);
  state.assemblies.push({
    id: 'other',
    mark: 'A-002',
    name: 'Other',
    mainId: 'c',
    memberIds: ['c', 'd'],
  });
  assert.throws(
    () => updateAssembly(state, 'assembly', { name: 'a', mainId: 'a', memberIds: ['a', 'c'] }),
    /annan assembly/,
  );
});
test('no-op edit preserves state references; drawing identity follows assembly renaming', () => {
  const state = fixture(),
    next = updateAssembly(state, 'assembly', state.assemblies[0]);
  assert.equal(next.assemblies, state.assemblies);
  assert.equal(next.drawings, state.drawings);
  state.drawings[0].name = 'Special drawing';
  const renamed = updateAssembly(state, 'assembly', { ...state.assemblies[0], name: 'Nytt namn' });
  assert.equal(renamed.drawings[0].name, 'Nytt namn');
});
test('changing main part preserves projected positions and stable references across different orientations', () => {
  const state = fixture();
  state.objects[1].end = [0, 300, 1000];
  state.drawings[0].sheet = {
    independentViews: true,
    drawingHandedness: 'right',
    sectionOrientation: 'source-up',
    views: [
      {
        id: 'front',
        projection: 'front',
        standard: true,
        source: { type: 'part', objectId: 'a' },
        camera: { center: [50, 50] },
        position: [10, 10],
        size: [120, 40],
        scale: 10,
      },
      {
        id: 's',
        section: {
          points: [
            [5, 0],
            [5, 100],
          ],
          side: 1,
          depth: 100,
        },
        source: { parentViewId: 'front', objectId: 'a' },
      },
      {
        id: 'd',
        detail: {
          points: [
            [0, 0],
            [100, 100],
          ],
        },
        source: { parentViewId: 'front', objectId: 'a' },
      },
    ],
  };
  state.drawings[0].annotations = [
    {
      view: 'front',
      points: [
        [10, 20],
        [50, 20],
      ],
      line: [30, 40],
    },
  ];
  const before = structuredClone(state.drawings[0]);
  const oldMatrix = assemblyDrawingMatrix(state.objects[0]),
    world = new THREE.Vector3(200, 50, 100),
    oldPoint = world.clone().applyMatrix4(oldMatrix),
    projected = oldPoint.clone().applyMatrix4(frameMatrix(partViewFrame('front')));
  const next = updateAssembly(state, 'assembly', { ...state.assemblies[0], mainId: 'b' });
  const sheet = next.drawings[0].sheet,
    newMatrix = assemblyDrawingMatrix(state.objects[1]);
  const newPoint = world.clone().applyMatrix4(newMatrix);
  const nextProjection = newPoint.clone().applyMatrix4(frameMatrix(sheet.views[0].assemblyFrame));
  assert.ok(nextProjection.distanceTo(projected) < 1e-8);
  assert.deepEqual(next.drawings[0].annotations, before.annotations);
  assert.deepEqual(sheet.views[0].position, before.sheet.views[0].position);
  assert.deepEqual(sheet.views[0].camera, before.sheet.views[0].camera);
  assert.deepEqual(sheet.views[1].section, before.sheet.views[1].section);
  assert.deepEqual(sheet.views[2].detail, before.sheet.views[2].detail);
  assert.equal(next.drawings[0].sourceId, 'b');
  assert.equal(sheet.views[0].source.objectId, 'b');
  const originalRefs = referenceCandidates([[projected.x, projected.y]], 'a', [oldPoint.toArray()]);
  const identities = [
    newPoint
      .clone()
      .applyMatrix4(new THREE.Matrix4().fromArray(sheet.assemblyReferenceMatrix))
      .toArray(),
  ];
  const afterRefs = referenceCandidates([[nextProjection.x, nextProjection.y]], 'a', identities);
  assert.deepEqual(resolveReference(originalRefs[0].reference, afterRefs), [
    nextProjection.x,
    nextProjection.y,
  ]);
  const back = updateAssembly({ ...state, ...next }, 'assembly', {
    ...next.assemblies[0],
    mainId: 'a',
  });
  const restored = oldPoint
    .clone()
    .applyMatrix4(frameMatrix(back.drawings[0].sheet.views[0].assemblyFrame));
  assert.ok(restored.distanceTo(projected) < 1e-8);
});
test('a missing main part can be replaced using the saved drawing frame', () => {
  const state = fixture();
  state.drawings[0].sheet = {
    assemblyModelMatrix: assemblyDrawingMatrix(state.objects[0]).toArray(),
    views: [{ id: 'front', projection: 'front' }],
  };
  state.objects = state.objects.filter((o) => o.id !== 'a');
  const next = updateAssembly(state, 'assembly', {
    name: 'Repaired',
    mainId: 'b',
    memberIds: ['b', 'c'],
  });
  assert.equal(assemblyValid(next.assemblies[0], state.objects), true);
  assert.equal(next.drawings[0].sourceId, 'b');
  assert.equal(next.drawings[0].number, 'A-001');
});
test('membership and main-part edits undo as one project transaction', () => {
  let state = fixture();
  const h = new ProjectHistory();
  h.checkpoint(state);
  Object.assign(
    state,
    updateAssembly(state, 'assembly', { name: 'Changed', mainId: 'c', memberIds: ['b', 'c'] }),
  );
  state = h.undo(state);
  assert.equal(state.assemblies[0].mainId, 'a');
  assert.equal(state.drawings[0].sourceId, 'a');
  state = h.redo(state);
  assert.equal(state.assemblies[0].mainId, 'c');
  assert.equal(state.drawings[0].sourceId, 'c');
  assert.equal(parseProjectFile(serializeProject(state)).assemblies[0].mark, 'A-001');
});
test('assembly drawings use assembly identity and upgrade earlier AS numbers without losing edits', () => {
  const state = fixture();
  assert.equal(state.drawings[0].number, state.assemblies[0].mark);
  assert.equal(state.drawings[0].name, state.assemblies[0].name);
  state.drawings[0].number = 'AS-001';
  state.drawings[0].name = 'Old title';
  state.drawings[0].annotations = [{ comment: 'Keep', points: [[1, 2]] }];
  const next = syncAssemblyDrawingIdentity(state);
  assert.equal(next[0].number, 'A-001');
  assert.equal(next[0].name, 'Balkpar');
  assert.equal(next[0].id, state.drawings[0].id);
  assert.deepEqual(next[0].annotations, state.drawings[0].annotations);
  const loaded = parseProjectFile(serializeProject(state));
  assert.equal(loaded.drawings[0].number, 'A-001');
  assert.equal(syncAssemblyDrawingIdentity(loaded), loaded.drawings);
  const context = drawingAttributeContext(state.drawings[0], state);
  assert.equal(context.drawing.number, 'A-001');
  assert.equal(context.drawing.name, 'Balkpar');
  for (const key of ['drawing.number', 'drawing.name'])
    assert.throws(
      () =>
        updateDrawingAttribute(
          next,
          'drawing',
          builtInAttributes.find((a) => a.key === key),
          'Manual',
        ),
      /följer assemblyn/,
    );
});
