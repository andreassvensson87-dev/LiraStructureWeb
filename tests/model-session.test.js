import { applyObjectDraft } from '../src/model/object-draft.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createProject } from '../src/project/project-state.js';
import { initialLevels } from '../src/levels.js';
import { ProjectHistory } from '../src/project/project-history.js';
import { createModelEditor } from '../src/app/model-editor.js';
import { createModelEditorState } from '../src/model/editor-state.js';
import { createToolSession } from '../src/model/tool-session.js';
import { createModelPreview } from '../src/model/ui/model-preview.js';
import { createModelVisibility } from '../src/model/ui/model-visibility.js';
import { installModelSession } from '../src/model/ui/model-session.js';
import { createModelPicking } from '../src/model/ui/model-picking.js';
import { installModelRenderer } from '../src/model/ui/model-renderer.js';
import { InstanceBatches } from '../src/model/instance-batches.js';
import { InteractionTimings } from '../src/model/interaction-timings.js';
import { modelBlockDefinition, modelBlockMembers } from '../src/blocks/model-adapter.js';

const noop = () => {};
function fixture(t) {
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => null, setItem: noop };
  t.after(() => {
    globalThis.localStorage = previousStorage;
  });
  // Only the UI boundary is substituted. Session, model commits, history,
  // meshes, visibility and snap indexing run their production implementations.
  const fields = new Map();
  const $ = (id) => {
    if (!fields.has(id))
      fields.set(id, {
        value: '',
        textContent: '',
        classList: { toggle: noop, remove: noop },
        setAttribute: noop,
        querySelector: () => ({ textContent: '' }),
      });
    return fields.get(id);
  };
  const project = createProject({
    grid: { x: [], y: [], objectBased: true },
    levels: initialLevels(),
  });
  project.objects = [
    {
      id: 'line',
      name: 'Linje',
      type: 'helperline',
      prefix: 'H',
      number: 1,
      start: [0, 0, 0],
      end: [1000, 0, 0],
    },
  ];
  const ui = createModelEditorState(),
    tools = createToolSession(),
    projectHistory = new ProjectHistory(),
    scene = new THREE.Scene(),
    objects = new THREE.Group(),
    renderState = { renderedById: new Map(), snapIndex: null };
  scene.add(objects);
  const controllers = {
    inspector: { rollback: noop, show: noop, finish: noop },
    helperController: { sync: noop },
    rotationLine: { visible: false },
    rotationHandle: { hide: noop },
  };
  const actions = Object.fromEntries(
    [
      'cancelInspectorPreview',
      'clearPlateOutline',
      'fillForm',
      'fillSettings',
      'fit',
      'readForm',
      'resetLength',
      'startTransform',
      'syncLocks',
      'syncMaterialPanel',
      'syncPlateUI',
      'syncWorkPlane',
      'updateSnapOverlay',
      'renderCutRelations',
      'syncIdentity',
    ].map((name) => [name, noop]),
  );
  const visibility = createModelVisibility({ project, ui, renderState, controllers });
  Object.assign(actions, visibility);
  const modelEditor = createModelEditor({ project, checkpoint: () => actions.checkpoint() });
  const objectFeedback = { setModel: noop, setSelection: noop, clearHover: noop };
  const preview = createModelPreview({
    project,
    ui,
    tools,
    scene,
    objects,
    objectFeedback,
    isVisible: visibility.isVisible,
    getReferences: () => null,
  });
  Object.assign(actions, preview);
  const instanceBatches = new InstanceBatches(scene);
  const context = {
    $,
    actions,
    controllers,
    project,
    projectHistory,
    ui,
    tools,
    modelEditor,
    scene,
    objects,
    renderState,
    objectFeedback,
    instanceBatches,
    host: { classList: { remove: noop }, clientWidth: 800, clientHeight: 600 },
    camera: new THREE.PerspectiveCamera(),
    grid: { set: noop },
    guide: { visible: false },
    frameGate: { invalidate: noop },
    renderer: { domElement: { style: {} } },
    navigation: { controls: { mouseButtons: {}, touches: {} } },
    insertionPoints: { update: noop },
    connectionMarkers: { sync: noop },
    interactionTimings: new InteractionTimings(),
  };
  installModelSession(context);
  installModelRenderer(context);
  actions.render();
  t.after(() => {
    preview.clearPreview();
    preview.dispose(scene);
  });
  return { ...context, ...visibility };
}

test('model session commits edits once, rejects invalid edits and restores deletion with undo/redo', (t) => {
  const f = fixture(t),
    original = structuredClone(f.project.objects);
  f.actions.select('line');
  assert.equal(f.projectHistory.canUndo, false, 'selection is not a model edit');
  assert.equal(f.ui.selected, 'line');
  assert.equal(f.actions.save({ end: [1500, 0, 0] }), true);
  assert.equal(f.projectHistory.past.length, 1);
  assert.deepEqual(f.project.objects[0].end, [1500, 0, 0]);
  assert.equal(f.actions.save({ end: [NaN, 0, 0] }), false);
  assert.equal(f.projectHistory.past.length, 1, 'invalid edits do not create history');
  assert.deepEqual(f.project.objects[0].end, [1500, 0, 0]);
  f.tools.operation = { mode: 'move' };
  f.tools.first = [50, 0, 0];
  f.actions.remove();
  assert.equal(f.project.objects.length, 0);
  assert.equal(f.projectHistory.past.length, 2);
  assert.equal(f.ui.selected, null);
  assert.equal(f.tools.operation, null);
  assert.equal(f.objects.children.length, 0);
  f.actions.restore('undo');
  assert.deepEqual(f.project.objects[0].end, [1500, 0, 0]);
  assert.equal(f.objects.children.length, 1);
  f.actions.restore('undo');
  assert.deepEqual(f.project.objects, original);
  f.actions.restore('redo');
  f.actions.restore('redo');
  assert.equal(f.project.objects.length, 0);
  assert.equal(f.objects.children.length, 0);
  assert.equal(f.ui.selectedIds.size, 0);
});
test('selecting a visible block member includes hidden members so delete and undo preserve complete instances', (t) => {
  const f = fixture(t),
    source = [0, 1].map((i) => ({
      id: `beam-${i}`,
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
    })),
    { definition, placement } = modelBlockDefinition(source);
  f.project.objects = modelBlockMembers(definition, {}, placement, 'block');
  const original = structuredClone(f.project.objects),
    [visible, hidden] = original;
  f.hiddenObjects.add(hidden.id);
  f.actions.render();
  f.actions.select(visible.id);
  assert.deepEqual(f.ui.selectedIds, new Set([visible.id, hidden.id]));
  f.actions.remove();
  assert.equal(f.project.objects.length, 0);
  assert.equal(f.projectHistory.past.length, 1);
  f.actions.restore('undo');
  assert.deepEqual(f.project.objects, original);
});

test('selection reuses rendered geometry; edits refresh geometry and snapping and release replaced meshes', (t) => {
  const f = fixture(t),
    initialMesh = f.objects.children[0],
    initialSnap = f.renderState.snapIndex;
  let disposed = false;
  initialMesh.geometry.addEventListener('dispose', () => {
    disposed = true;
  });
  f.actions.select('line');
  assert.equal(f.objects.children[0], initialMesh);
  assert.equal(f.renderState.snapIndex, initialSnap);
  assert.equal(disposed, false);
  f.actions.save({ end: [1800, 0, 0] });
  assert.notEqual(f.objects.children[0], initialMesh);
  assert.notEqual(f.renderState.snapIndex, initialSnap);
  assert.equal(disposed, true);
  assert.deepEqual(f.renderState.snapIndex.model[0].end, [1800, 0, 0]);
  f.actions.restore('undo');
  assert.deepEqual(f.renderState.snapIndex.model[0].end, [1000, 0, 0]);
  f.hiddenObjects.add('line');
  f.actions.render();
  assert.equal(f.objects.children[0].visible, false);
});

test('grid selection lock excludes picks and bulk selection while preserving visibility and snapping', (t) => {
  const f = fixture(t);
  f.project.objects.push({
    ...f.project.objects[0],
    id: 'grid',
    type: 'gridline',
    name: '1',
    gridAxis: 'x',
  });
  f.project.objects[0] = { ...f.project.objects[0], start: [0, 0, -10], end: [1000, 0, -10] };
  f.actions.render();
  const gridMesh = f.renderState.renderedById.get('grid').child;
  const snapIndex = f.renderState.snapIndex;
  const camera = new THREE.OrthographicCamera(0, 1000, 500, -500, 1, 2000);
  camera.position.set(0, 0, 1000);
  camera.updateProjectionMatrix();
  const picking = createModelPicking({
    ...f,
    camera,
    host: {
      clientWidth: 800,
      clientHeight: 600,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    },
    getRenderedById: () => f.renderState.renderedById,
    getSnapIndex: () => f.renderState.snapIndex,
    getReferences: () => null,
    workPlanePrompt: noop,
    updateSnapOverlay: noop,
  });
  picking.ray({ clientX: 400, clientY: 300 });
  assert.equal(picking.selectionHit(), 'grid');
  f.actions.setSelection(['line', 'grid']);
  f.actions.setGridSelectionLocked(true);
  assert.deepEqual([...f.ui.selectedIds], ['line'], 'locking preserves other selected objects');
  assert.equal(
    picking.selectionHit(),
    'line',
    'locked geometry allows picking the object behind it',
  );
  assert.equal(f.actions.isSelectable('grid'), false);
  assert.deepEqual([...f.actions.userSelection(['grid', 'line'])], ['line']);
  f.actions.setSelection(['grid', 'line']);
  assert.deepEqual([...f.ui.selectedIds], ['line'], 'bulk selection also respects the lock');
  f.actions.select('grid');
  assert.equal(f.ui.selectedIds.size, 0);
  assert.equal(gridMesh.visible, true);
  assert.equal(f.renderState.snapIndex, snapIndex);
  assert.ok(snapIndex.model.some((object) => object.id === 'grid'));
  assert.equal(f.projectHistory.canUndo, false, 'locking is UI state, not a model edit');
  f.actions.setGridSelectionLocked(false);
  f.actions.select('grid');
  assert.equal(f.ui.selected, 'grid');
  assert.equal(picking.selectionHit(), 'grid');
});

test('shared create attributes commit with geometry once and never overwrite attributes during later edits', (t) => {
  const f = fixture(t),
    before = structuredClone(f.project.objects);
  let draft = { name: 'Balk', partSeries: { prefix: 'BT', start: 0 } };
  f.actions.applyCreationAttributes = (object) => applyObjectDraft(object, draft);
  const shape = {
    type: 'sweep',
    profile: 'rect',
    width: 100,
    height: 200,
    thickness: 0,
    rotation: 0,
    start: [0, 0, 0],
    end: [1000, 0, 0],
  };
  assert.equal(f.actions.save(shape), false);
  assert.deepEqual(f.project.objects, before);
  assert.equal(f.projectHistory.past.length, 0);
  draft.partSeries.start = 100;
  assert.equal(f.actions.save(shape), true);
  assert.equal(f.projectHistory.past.length, 1);
  const saved = f.project.objects.find((o) => o.id === f.ui.selected);
  assert.equal(saved.name, 'Balk');
  assert.deepEqual(saved.partSeries, { prefix: 'BT', start: 100 });
  draft = { name: 'Annat utkast', partSeries: { prefix: 'XX', start: 999 } };
  assert.equal(f.actions.save({ width: 300 }), true);
  assert.equal(f.projectHistory.past.length, 2);
  assert.equal(f.project.objects.find((o) => o.id === saved.id).name, 'Balk');
  assert.deepEqual(f.project.objects.find((o) => o.id === saved.id).partSeries, {
    prefix: 'BT',
    start: 100,
  });
  f.actions.restore('undo');
  assert.equal(f.project.objects.find((o) => o.id === saved.id).width, 100);
  f.actions.restore('undo');
  assert.deepEqual(f.project.objects, before);
});

test('a successful radius correction clears both errors left by a rejected profile insertion', (t) => {
  const f = fixture(t);
  f.project.objects = [
    {
      id: 'poly',
      name: 'Polysweep',
      type: 'polysweep',
      prefix: 'PS',
      number: 1,
      profile: 'rect',
      width: 100,
      height: 100,
      thickness: 0,
      rotation: 0,
      points: [
        [0, 0, 0],
        [2000, 0, 0],
        [2000, 2000, 0],
        [4000, 2000, 0],
      ],
      radii: [0, 60, 60, 0],
    },
  ];
  f.actions.select('poly');
  assert.equal(
    f.actions.save({ placement: { horizontalAlignment: 'right', verticalAlignment: 'top' } }),
    false,
  );
  assert.match(f.$('inspector-error').textContent, /för liten/);
  assert.match(f.$('error').textContent, /för liten/);
  assert.equal(f.projectHistory.past.length, 0);
  assert.equal(f.actions.save({ radii: [0, 300, 300, 0] }), true);
  assert.equal(f.$('inspector-error').textContent, '');
  assert.equal(f.$('error').textContent, '');
  assert.equal(f.projectHistory.past.length, 1);
  assert.equal(
    f.actions.save({ placement: { horizontalAlignment: 'right', verticalAlignment: 'top' } }),
    true,
  );
  assert.equal(f.$('inspector-error').textContent, '');
});
