import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPlacementController } from '../src/model/ui/placement-controller.js';
import { createModelPreview } from '../src/model/ui/model-preview.js';
import { createModelEditor } from '../src/app/model-editor.js';
import { createModelEditorState } from '../src/model/editor-state.js';
import { createToolSession, resetToolInteraction } from '../src/model/tool-session.js';
import { ProjectHistory } from '../src/project/project-history.js';
import { createProject } from '../src/project/project-state.js';

function fixture(t) {
  const previous = globalThis.document;
  const fields = new Map();
  globalThis.document = {
    getElementById: (id) => {
      if (!fields.has(id))
        fields.set(id, { value: '', textContent: '', hidden: true, addEventListener() {} });
      return fields.get(id);
    },
    querySelectorAll: () => [],
  };
  t.after(() => {
    globalThis.document = previous;
  });
  const project = createProject({
    grid: { x: [0, 1000], y: [0, 1000] },
    levels: { active: 'l', items: [{ id: 'l', name: 'Plan', elevation: 0 }] },
  });
  project.objects = [
    { id: 'line', type: 'helperline', prefix: 'H', number: 1, start: [0, 0, 0], end: [1000, 0, 0] },
  ];
  const ui = createModelEditorState(),
    tools = createToolSession(),
    history = new ProjectHistory(),
    scene = new THREE.Scene(),
    objects = new THREE.Group();
  ui.selectedIds = new Set(['line']);
  ui.selected = 'line';
  const modelEditor = createModelEditor({ project, checkpoint: () => history.checkpoint(project) });
  const preview = createModelPreview({
    project,
    ui,
    tools,
    scene,
    objects,
    objectFeedback: { setModel() {} },
    isVisible: () => true,
    getReferences: () => null,
  });
  const originalMesh = preview.mesh(project.objects[0]);
  objects.add(originalMesh);
  scene.add(objects);
  t.after(() => {
    preview.clearPreview();
    preview.dispose(objects);
  });
  const guide = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineDashedMaterial(),
  );
  t.after(() => preview.dispose(guide));
  const controller = createPlacementController({
    project,
    ui,
    tools,
    modelEditor,
    scene,
    objects,
    guide,
    preview,
    renderer: { domElement: { focus() {} } },
    frameGate: { invalidate() {} },
    setDrawing: (value) => resetToolInteraction(tools, value),
    syncOperationUI() {},
    render() {},
    checkpoint: () => history.checkpoint(project),
    updateSnapOverlay() {},
    getReferences: () => null,
    getItem: () => null,
    getInspector: () => ({ focusGeometry() {} }),
    fillForm() {},
    updateForm() {},
    point: () => [100, 0, 0],
  });
  return { controller, project, ui, tools, history, preview, originalMesh, scene, fields };
}

test('typed placement previews without changing the model, rejects invalid distances and commits one reversible move/copy', (t) => {
  const f = fixture(t),
    original = structuredClone(f.project.objects);
  f.controller.startTransform('move');
  f.tools.first = [0, 0, 0];
  f.controller.toggleLock('X');
  f.fields.get('draw-length').value = '100';
  f.controller.updateTypedLength();
  assert.deepEqual(f.project.objects, original);
  assert.equal(f.history.canUndo, false);
  assert.equal(f.originalMesh.visible, true, 'preview must preserve original snap targets');
  assert.ok(f.ui.preview && f.scene.children.includes(f.ui.preview));
  f.fields.get('draw-length').value = '-1';
  f.controller.updateTypedLength();
  assert.equal(f.tools.typedPoint, null);
  assert.equal(f.ui.preview, null);
  assert.ok(f.fields.get('draw-length-error').textContent);
  assert.equal(f.history.canUndo, false);
  f.fields.get('draw-length').value = '100';
  f.controller.updateTypedLength();
  assert.equal(f.controller.commitPoint(f.tools.typedPoint), true);
  assert.deepEqual(f.project.objects[0].start, [100, 0, 0]);
  assert.equal(f.history.past.length, 1);
  f.controller.startTransform('copy');
  f.tools.first = [100, 0, 0];
  assert.equal(f.controller.commitPoint([300, 0, 0]), true);
  assert.equal(f.project.objects.length, 2);
  assert.deepEqual(f.project.objects[0].start, [100, 0, 0]);
  assert.deepEqual(f.project.objects[1].start, [300, 0, 0]);
  assert.deepEqual([...f.ui.selectedIds], [f.project.objects[1].id]);
  assert.equal(f.history.past.length, 2);
  const undone = f.history.undo(f.project);
  assert.equal(undone.objects.length, 1);
  assert.deepEqual(f.history.undo(undone).objects, original);
});
