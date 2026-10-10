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
import { installModelRenderer } from '../src/model/ui/model-renderer.js';
import { InstanceBatches } from '../src/model/instance-batches.js';
import { InteractionTimings } from '../src/model/interaction-timings.js';

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
