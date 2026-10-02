import { ReferenceModels } from './references/reference-models.js';
import { drawingAttributeContext } from './drawing-attributes.js';
import { installDrawingSettings } from './drawing-settings.js';
import { setupPWA } from './app/pwa.js';
import { moveGripPoints } from './model/grips.js';
import { createGroupedToolbox } from './model/ui/toolbox.js';
import { createHelperController } from './model/ui/helper-controller.js';
import { isHelper, isPhysical } from './model-object.js';
import { FastenerUI } from './fasteners/ui.js';
import { isFastener } from './fasteners/object-type.js';
import { axisPlacement } from './fasteners/geometry.js';
import { removeFastenerRelations, validateFastenerTargets } from './fasteners/relations.js';
let fastenerUI = null;
import { typeName } from './object-identity.js';
import { createSweepForm } from './model/ui/sweep-form.js';
import { createWorkplaneController } from './model/ui/workplane-controller.js';
import { createRotationController } from './model/ui/rotation-controller.js';
import { createSelectionController } from './model/ui/selection-controller.js';
import { createPlateController } from './model/ui/plate-controller.js';
import { createModelEditorState } from './model/editor-state.js';
const ui = createModelEditorState();
import { createToolSession, resetToolLength, resetToolInteraction } from './model/tool-session.js';
const tools = createToolSession();
import { createSettingsController } from './app/settings-controller.js';

import { transformCandidates, applyObjectBatch } from './model/tools/transform-tool.js';
import { installModelPointer } from './model/pointer-controller.js';
import { modelKeyboardCommand } from './model/keyboard-command.js';
import { createObjectMesh } from './model/object-mesh.js';
import { createProject } from './project/project-state.js';
import { ProjectHistory } from './project/project-history.js';
import { FrameEditor } from './frame-editor.js';
import { workPlaneFromPoints, drawingWorkPlane } from './work-plane.js';

import { partStatus } from './part-marks.js';
import { createDrawingController } from './app/drawing-controller.js';
let drawingManager = null;

let planView = null;

import { LevelsUI, initialLevels, levelElevation } from './levels.js';
let levelsUI = null;
import { nextIdentity, identityError } from './object-identity.js';
import { ModelTree } from './model-tree.js';
let modelTree = null;
let referenceModels = null;
const hiddenObjects = new Set();
const isVisible = (id) =>
  !hiddenObjects.has(id) && (ui.showHelpers || !isHelper(project.objects.find((s) => s.id === id)));
import { MaterialUI } from './material-ui.js';
let materialUI = null;
import './style.css';

import { ProfilePicker } from './profile-picker.js';
let profilePicker = null;
import { SectionEditor } from './section-editor.js';

import { isLineCut } from './line-cut.js';
import { Inspector } from './inspector.js';
let inspector = null;
import * as THREE from 'three';
import { createModelViewport } from './model/viewport.js';

import { InsertionPoints } from './insertion-points.js';
import { endpointAtLength } from './length-input.js';
import { resolveSnap } from './snap.js';
import { GridLines, defaultGrid } from './grid-lines.js';

import { isCut, cutsForModel, geometryForModel, isPlate, validateObject } from './model-object.js';
import { platePoint, plateNormal } from './plate.js';
const $ = (id) => document.getElementById(id),
  fmt = (n) => n.toLocaleString('sv-SE', { maximumFractionDigits: 3 });

const host = $('viewport');
const { scene, camera, renderer, navigation } = createModelViewport(host, (message) => {
  $('status').textContent = message;
});
const project = createProject({ grid: defaultGrid, levels: initialLevels() });
const projectHistory = new ProjectHistory();

const grid = new GridLines(scene, host);
grid.set({ ...project.grid, z: levelElevation(project.levels) });
const objects = new THREE.Group();
scene.add(objects);
const insertionPoints = new InsertionPoints(
  host,
  (kind) =>
    typeof kind === 'object'
      ? startGrip(kind)
      : String(kind).startsWith('edge:')
        ? changePlateVertex(Number(kind.split(':')[1]), false)
        : typeof kind === 'number'
          ? startPlateVertex(kind)
          : startTransform(kind),
  {
    onRemove: (index) => changePlateVertex(index, true),
    canRemove: () => {
      const s = project.objects.find((s) => s.id === ui.selected);
      return s?.type === 'plate' ? s.polygon.length > 3 : null;
    },
  },
);
const raycaster = new THREE.Raycaster(),
  mouse = new THREE.Vector2();

const { workPlaneGuide, planeViewButton, syncWorkPlane, workPlanePrompt, pickWorkPlane } =
  createWorkplaneController({
    scene,
    tools,
    renderer,
    getInspector: () => inspector,
    setDrawing,
    syncOperationUI,
  });
function resetLength() {
  resetToolLength(tools);
  $('draw-length').value = '';
  $('draw-length-error').textContent = '';
  $('draw-length-form').hidden = true;
}
function plateLengthActive() {
  return (
    tools.operation?.mode === 'plateCreate' &&
    !tools.operation.lineCut &&
    !!tools.operation.frame &&
    tools.operation.polygon.length > 0
  );
}
function updateTypedLength() {
  const text = $('draw-length').value;
  tools.typedPoint = null;
  $('draw-length-error').textContent = '';
  if (!text.trim()) {
    tools.typedDirection = null;
    if (tools.lastPointer) updatePointer(tools.lastPointer);
    return;
  }
  if (!tools.typedDirection) {
    tools.typedDirection =
      tools.lastDirection?.slice() ??
      (tools.axisLock ? { X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] }[tools.axisLock] : null);
    tools.directionLabel = tools.axisLock
      ? `${tools.axisLock} låst`
      : tools.activeSnap?.label || 'Vald riktning';
  }
  try {
    const end = endpointAtLength(tools.first, tools.typedDirection, text);
    const frame = drawingWorkPlane(tools.operation, tools.temporaryPlane);
    if (
      frame &&
      ['plateCreate', 'plateVertex'].includes(tools.operation?.mode) &&
      Math.abs(
        new THREE.Vector3(...end)
          .sub(new THREE.Vector3(...frame.origin))
          .dot(plateNormal({ frame })),
      ) > 0.001
    )
      throw new Error('Riktningen måste ligga i arbetsplanet.');
    if (plateLengthActive()) {
      const normal = plateNormal(tools.operation);
      if (
        Math.abs(new THREE.Vector3(...end).sub(new THREE.Vector3(...tools.first)).dot(normal)) >
        0.001
      )
        throw new Error('Riktningen måste ligga i arbetsplanet.');
    } else {
      const error = candidates(end).map(validateSweep).find(Boolean);
      if (error) throw new Error(error);
    }
    tools.typedPoint = end;
    tools.activeSnap = {
      point: end,
      label: `${tools.directionLabel} · ${text.trim()} mm`,
      kind: 'direction',
    };
    if (plateLengthActive()) previewPlatePoint(end);
    else showPreview(end);
    updateSnapOverlay();
  } catch (error) {
    clearPreview();
    guide.visible = false;
    tools.activeSnap = null;
    updateSnapOverlay();
    $('draw-length-error').textContent = error.message;
  }
}
$('draw-length').addEventListener('input', updateTypedLength);
$('draw-length-form').onsubmit = (e) => {
  e.preventDefault();
  if (!tools.drawing || !tools.first) return;
  updateTypedLength();
  if (tools.typedPoint && plateLengthActive()) {
    pickPlatePoint(tools.typedPoint, true);
    renderer.domElement.focus({ preventScroll: true });
  } else if (tools.typedPoint && commitPoint(tools.typedPoint)) {
    renderer.domElement.focus({ preventScroll: true });
  }
};
const snapMarker = document.createElement('div');
snapMarker.className = 'snap-marker';
snapMarker.hidden = true;
snapMarker.setAttribute('aria-hidden', 'true');
host.append(snapMarker);
const snapStatus = document.createElement('span');
snapStatus.id = 'snap-status';
document.querySelector('footer').append(snapStatus);
const guide = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
  new THREE.LineDashedMaterial({ color: 0x16815e, dashSize: 180, gapSize: 90, depthTest: false }),
);
guide.visible = false;
guide.renderOrder = 10;
scene.add(guide);
function updateSnapOverlay() {
  grid.highlight(tools.drawing ? tools.activeSnap?.gridIds : []);
  const active = tools.drawing && tools.activeSnap?.point;
  const text = active ? tools.activeSnap.label : '';
  if (snapStatus.textContent !== text) snapStatus.textContent = text;
  const colors = { X: '#ba4b47', Y: '#22845f', Z: '#3e75b5' };
  guide.material.color.set(colors[tools.activeSnap?.axis] || '#16815e');
  snapMarker.hidden =
    !active || tools.activeSnap.kind === 'free' || tools.activeSnap.kind === 'direction';
  if (!snapMarker.hidden) {
    const p = new THREE.Vector3(...tools.activeSnap.point).project(camera);
    snapMarker.style.left = `${((p.x + 1) * host.clientWidth) / 2}px`;
    snapMarker.style.top = `${((1 - p.y) * host.clientHeight) / 2}px`;
    snapMarker.dataset.symbol = tools.activeSnap.symbol || 'square';
  }
}
function syncLocks() {
  document.querySelectorAll('[data-axis]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.axis === tools.axisLock));
    b.disabled = !tools.drawing || !tools.first;
  });
}
function toggleLock(axis) {
  if (!tools.drawing || !tools.first) return;
  tools.axisLock = tools.axisLock === axis ? null : axis;
  tools.lastDirection = null;
  tools.typedDirection = null;
  tools.typedPoint = null;
  $('draw-length').value = '';
  $('draw-length-error').textContent = '';
  syncLocks();
  if (tools.lastPointer) updatePointer(tools.lastPointer);
}
document
  .querySelectorAll('[data-axis]')
  .forEach((b) => (b.onclick = () => toggleLock(b.dataset.axis)));

renderer.setAnimationLoop(() => {
  if (!ui.marquee && !rotationHandle.drag) navigation.controls.update();
  // Project labels with the same camera transform used to render this frame.
  camera.updateMatrixWorld();
  grid.updateLabels(camera, host.clientWidth, host.clientHeight);
  insertionPoints.update(
    camera,
    host.clientWidth,
    host.clientHeight,
    (inspector?.session?.batch && !inspector.session.error
      ? project.objects.map((s) => inspector.session.batch.find((b) => b.id === s.id) || s)
      : tools.operation?.mode === 'rotate' && tools.operation.batch
        ? project.objects.map((s) => tools.operation.batch.find((b) => b.id === s.id) || s)
        : project.objects
    ).filter((s) => isVisible(s.id)),
    ui.selectedIds,
    tools.drawing,
    ui.previewSweep?.start ?? tools.first,
    ui.previewSweep?.end ?? tools.activeSnap?.point,
    tools.operation?.mode === 'plateCreate' && tools.operation.frame
      ? tools.operation.polygon.map((p) => platePoint(tools.operation, p))
      : tools.operation?.mode === 'workPlane'
        ? tools.operation.points
        : [],
  );
  updateSnapOverlay();
  rotationHandle.update();
  updatePlateNormal();
  renderer.render(scene, camera);
});

const { readForm, fillForm, updateForm } = createSweepForm({
  project,
  tools,
  ui,
  getProfilePicker: () => profilePicker,
  fillPlate: (s) => fillPlate(s),
  save,
  updateTypedLength,
  updatePointer,
  clearPreview,
});
function dispose(o) {
  o.traverse((child) => {
    child.geometry?.dispose();
    if (child.material) child.material.dispose();
  });
}
function clearPreview() {
  objects.children.forEach((child) => (child.visible = isVisible(child.userData.id)));
  ui.previewSweep = null;
  if (ui.preview) {
    scene.remove(ui.preview);
    dispose(ui.preview);
    ui.preview = null;
  }
}
function mesh(s, ghost = false, model = project.objects) {
  return createObjectMesh(s, {
    model,
    selectedIds: ui.selectedIds,
    transparentView: ui.transparentView,
    ghost,
  });
}
function render() {
  for (const child of [...objects.children]) {
    objects.remove(child);
    dispose(child);
  }
  project.objects.forEach((s) => {
    const child = mesh(s);
    child.visible =
      isVisible(s.id) &&
      (tools.operation?.mode !== 'rotate' || tools.operation.picking || !ui.selectedIds.has(s.id));
    objects.add(child);
  });
  $('count').textContent = project.objects.length;
  modelTree?.render(project.objects, ui.selectedIds);
  syncIdentity();
  $('undo').disabled = !projectHistory.canUndo;
  $('redo').disabled = !projectHistory.canRedo;
  $('delete').hidden = !ui.selected;
  $('deselect').hidden = !ui.selected;
  $('apply').textContent = ui.selected ? 'Uppdatera sweep' : 'Skapa sweep';
  $('mode-label').textContent = ui.selected
    ? project.objects.find((s) => s.id === ui.selected)?.name
    : 'Ny profil';
  $('form').hidden = ui.selectedIds.size > 1;
  $('multi-selection').hidden = ui.selectedIds.size < 2;
  $('multi-count').textContent = `${ui.selectedIds.size} objekt markerade`;
  $('mode-label').textContent =
    ui.selectedIds.size > 1 ? `${ui.selectedIds.size} markerade` : $('mode-label').textContent;
  syncOperationUI();
  syncPlateUI();
  renderCutRelations();
  syncMaterialPanel();
  helperController.sync();
  fastenerUI?.sync(
    project.objects.filter((s) => ui.selectedIds.has(s.id)),
    tools.operation,
  );
  planView?.sync();
  if (drawingManager?.dialog.open) drawingManager.render();
}
function setSelection(ids, keepTab = false) {
  inspector?.rollback();
  setDrawing(false);
  ui.selectedIds = new Set(ids);
  ui.selected = ui.selectedIds.size === 1 ? [...ui.selectedIds][0] : null;
  if (ui.selected) fillForm(project.objects.find((s) => s.id === ui.selected));
  render();
  if (ui.selectedIds.size && !keepTab) inspector.show('properties');
}
function select(id, additive = false, keepTab = false) {
  const ids = additive ? new Set(ui.selectedIds) : new Set();
  if (id) {
    if (additive && ids.has(id)) ids.delete(id);
    else ids.add(id);
  }
  setSelection(ids, keepTab);
}
function checkpoint() {
  projectHistory.checkpoint(project);
}
function save(s) {
  const error = validateSweep(s);
  if (error) {
    $('error').textContent = error;
    $('inspector-error').textContent = error;
    return false;
  }
  checkpoint();
  if (ui.selected) {
    project.objects = applyObjectBatch(project.objects, [
      { ...project.objects.find((o) => o.id === ui.selected), ...s },
    ]).objects;
  } else {
    const id = crypto.randomUUID();
    project.objects.push({
      ...(isHelper(s) ? {} : ui.draftMaterial),
      ...s,
      ...nextIdentity(s, project.objects),
      id,
      name: `${typeName(s)} ${String(++ui.sequence).padStart(2, '0')}`,
    });
    ui.selected = id;
  }
  ui.selectedIds = new Set([ui.selected]);
  setDrawing(false);
  render();
  $('status').textContent = `${typeName(s)} skapad`;
  return true;
}
$('form').onsubmit = (e) => {
  e.preventDefault();
  const updating = ui.selected !== null;
  if (save(readForm()) && !updating) fit();
};
$('deselect').onclick = () => select(null);
function remove() {
  if (!ui.selectedIds.size) return;
  setDrawing(false);
  checkpoint();
  project.objects = removeFastenerRelations(project.objects, ui.selectedIds)
    .map((s) =>
      isCut(s) ? { ...s, targets: s.targets.filter((id) => !ui.selectedIds.has(id)) } : s,
    )
    .filter((s) => !isCut(s) || s.targets.length);
  ui.selected = null;
  ui.selectedIds.clear();
  clearPreview();
  render();
  $('status').textContent = 'Markeringen borttagen';
}
$('delete').onclick = $('multi-delete').onclick = remove;
function restore(direction) {
  const next = projectHistory[direction](project);
  if (!next) return;
  Object.assign(project, next);
  levelsUI?.sync();
  fillSettings();
  grid.set({ ...project.grid, z: levelElevation(project.levels) });
  select(null);
  $('status').textContent = 'Modellen återställd';
}
$('undo').onclick = () => restore('undo');
$('redo').onclick = () => restore('redo');
function setDrawing(value) {
  inspector?.rollback();
  cancelInspectorPreview();
  clearPlateOutline();
  rotationLine.visible = false;
  rotationHandle.hide();
  objects.visible = true;
  objects.children.forEach((child) => (child.visible = isVisible(child.userData.id)));
  ui.boxMode = false;
  host.classList.remove('box-selecting');
  if ($('box-select')) {
    $('box-select').classList.remove('active');
    $('box-select').setAttribute('aria-pressed', 'false');
  }
  resetToolInteraction(tools, value);
  syncWorkPlane();
  resetLength();
  guide.visible = false;
  syncLocks();
  updateSnapOverlay();
  clearPreview();
  navigation.controls.mouseButtons.LEFT = value ? null : THREE.MOUSE.ROTATE;
  navigation.controls.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE;
  navigation.controls.touches.ONE = value ? null : THREE.TOUCH.ROTATE;
  renderer.domElement.style.cursor = value ? 'crosshair' : 'default';
  $('draw').classList.toggle('active', value);
  $('select').classList.toggle('active', !value);
  $('select').setAttribute('aria-pressed', String(!value));
  $('draw').setAttribute('aria-pressed', String(value));
  syncOperationUI();
  insertionPoints.update(
    camera,
    host.clientWidth,
    host.clientHeight,
    project.objects.filter((s) => isVisible(s.id)),
    ui.selectedIds,
    tools.drawing,
    null,
    null,
  );
  if (!value && ui.selected) {
    const s = project.objects.find((s) => s.id === ui.selected);
    if (s) fillForm(s);
  }
  syncPlateUI();
  syncMaterialPanel();
  helperController.sync();
  fastenerUI?.sync(
    project.objects.filter((s) => ui.selectedIds.has(s.id)),
    tools.operation,
  );
}
function startDrawing() {
  select(null);
  setDrawing(true);
  inspector.show('properties');
}
function syncOperationUI() {
  for (const id of ['move', 'copy', 'rotate']) {
    $(id).disabled = !ui.selectedIds.size;
    $(id).classList.toggle('active', tools.operation?.mode === id);
    $(id).setAttribute('aria-pressed', String(tools.operation?.mode === id));
  }
  $('draw').classList.toggle('active', tools.drawing && !tools.operation);
  $('draw').setAttribute('aria-pressed', String(tools.drawing && !tools.operation));
  $('linecut').disabled = !project.objects.some(
    (s) => ui.selectedIds.has(s.id) && !isPlate(s) && isPhysical(s),
  );
  $('linecut').classList.toggle('active', !!tools.operation?.lineCut);
  $('linecut').setAttribute('aria-pressed', String(!!tools.operation?.lineCut));
  $('polygoncut').disabled = !project.objects.some(
    (s) => ui.selectedIds.has(s.id) && isPhysical(s),
  );
  $('polygoncut').classList.toggle(
    'active',
    !!tools.operation?.cutTargets && !tools.operation.lineCut,
  );
  $('polygoncut').setAttribute(
    'aria-pressed',
    String(!!tools.operation?.cutTargets && !tools.operation.lineCut),
  );
  $('form').inert = !!tools.operation;
  $('plate-form').inert = !!tools.operation && !['plateCreate'].includes(tools.operation.mode);
  $('plate').classList.toggle(
    'active',
    tools.operation?.mode === 'plateCreate' && !tools.operation.cutTargets,
  );
  $('plate').setAttribute(
    'aria-pressed',
    String(tools.operation?.mode === 'plateCreate' && !tools.operation.cutTargets),
  );
  $('distance-label').textContent = tools.operation ? 'Avstånd' : 'Längd';
  $('draw-length-form').querySelector('[type=submit]').textContent =
    tools.operation && !tools.operation.mode.startsWith('helper')
      ? tools.operation.mode === 'copy'
        ? 'Kopiera ↵'
        : 'Flytta ↵'
      : 'Skapa ↵';
}
function startTransform(mode) {
  const sources = project.objects.filter((s) => ui.selectedIds.has(s.id));
  const source = sources[0];
  if (!source || ((mode === 'start' || mode === 'end') && sources.length !== 1)) return;
  setDrawing(true);
  tools.operation = { mode, source: structuredClone(source), sources: structuredClone(sources) };
  syncOperationUI();
  if (mode === 'start' || mode === 'end') {
    tools.first = [...source[mode]];
    syncLocks();
    $('draw-length-form').hidden = false;
  }
  if ((mode === 'start' || mode === 'end') && !isHelper(source)) inspector.focusGeometry(mode);
  $('status').textContent =
    mode === 'copy'
      ? 'Kopiera · Välj baspunkt'
      : mode === 'move'
        ? 'Flytta · Välj baspunkt'
        : `Flytta ${mode === 'start' ? 'startpunkt' : 'slutpunkt'}`;
  renderer.domElement.focus({ preventScroll: true });
}
function startGrip(grip) {
  const ids = new Set(grip.refs.map((r) => r.id));
  const sources = structuredClone(project.objects.filter((s) => ids.has(s.id)));
  setDrawing(true);
  tools.operation = { mode: 'grip', sources, refs: grip.refs };
  $('status').textContent = 'Flytta insättningspunkter · Välj målpunkt eller ange avstånd';
  tools.first = [...grip.point];
  syncOperationUI();
  syncLocks();
  $('draw-length-form').hidden = false;
  renderer.domElement.focus({ preventScroll: true });
}
function candidates(target) {
  if (tools.operation?.mode === 'fastenerCreate')
    return [
      {
        ...tools.operation.draft,
        ...axisPlacement(tools.operation.draft.spec, tools.first, target),
      },
    ];
  if (tools.operation?.mode === 'grip')
    return moveGripPoints(tools.operation.sources, tools.operation.refs, target);
  if (tools.operation?.mode === 'helperline')
    return [{ type: 'helperline', start: [...tools.first], end: [...target] }];
  return transformCandidates(
    tools.operation,
    tools.first,
    target,
    tools.operation ? null : readForm(),
  );
}
function commitPoint(target) {
  let batch;
  try {
    batch = candidates(target);
  } catch (error) {
    $('draw-length-error').textContent = error.message;
    return false;
  }
  const error = batch.map(validateSweep).find(Boolean);
  if (error) {
    $('draw-length-error').textContent = error;
    $('error').textContent = error;
    $('inspector-error').textContent = error;
    return false;
  }
  const mode = tools.operation?.mode;
  if (!mode || mode === 'helperline' || mode === 'fastenerCreate') {
    if (!save(batch[0])) return false;
    fillForm(project.objects.find((s) => s.id === ui.selected));
  } else {
    checkpoint();
    const result = applyObjectBatch(project.objects, batch, { copy: mode === 'copy' });
    project.objects = result.objects;
    if (mode === 'copy') ui.selectedIds = new Set(result.ids);
    ui.selected = ui.selectedIds.size === 1 ? [...ui.selectedIds][0] : null;
    setDrawing(false);
    render();
  }
  $('status').textContent =
    mode === 'fastenerCreate'
      ? 'Skruv och hål skapade'
      : mode === 'helperline'
        ? 'Hjälplinje skapad'
        : mode === 'copy'
          ? 'Markeringen kopierad'
          : mode
            ? 'Markeringen flyttad'
            : 'Sweep skapad';
  return true;
}
$('move').onclick = () => startTransform('move');
$('copy').onclick = () => startTransform('copy');
$('draw').onclick = startDrawing;
$('select').onclick = () => setDrawing(false);
function fit(direction, referenceBounds = null) {
  const bounds =
    referenceBounds ||
    new THREE.Box3()
      .setFromObject(objects)
      .union(grid.bounds)
      .union(referenceModels?.bounds() || new THREE.Box3());
  navigation.fit(bounds, direction);
}
$('transparent-view').onclick = () => {
  ui.transparentView = !ui.transparentView;
  const button = $('transparent-view');
  button.setAttribute('aria-pressed', String(ui.transparentView));
  button.title = ui.transparentView
    ? 'Transparent · byt till homogent'
    : 'Homogent · byt till transparent';
  scene.traverse((o) => {
    if (!o.isMesh || !o.userData.id || o.userData.cut || o.userData.ghost) return;
    o.material.transparent = ui.transparentView;
    o.material.opacity = ui.transparentView ? 0.3 : 1;
    o.material.depthWrite = !ui.transparentView;
    o.material.needsUpdate = true;
  });
};
planeViewButton.onclick = () => {
  const frame = tools.temporaryPlane ?? {
    origin: [0, 0, levelElevation(project.levels)],
    u: [1, 0, 0],
    v: [0, 1, 0],
  };
  const normal = new THREE.Vector3(...frame.u).cross(new THREE.Vector3(...frame.v)).normalize();
  const center = tools.temporaryPlane
    ? tools.workPlanePoints
        .reduce((sum, p) => sum.add(new THREE.Vector3(...p)), new THREE.Vector3())
        .multiplyScalar(1 / tools.workPlanePoints.length)
    : navigation.controls.target.clone().setZ(levelElevation(project.levels));
  navigation.lookAtPlane(center, normal, new THREE.Vector3(...frame.v));
  if (tools.lastPointer && tools.drawing) updatePointer(tools.lastPointer);
  $('status').textContent = tools.temporaryPlane
    ? 'Vy rakt mot arbetsplanet'
    : 'Vy rakt mot aktiv nivå';
};
$('fit').onclick = () => fit();
$('top').onclick = () => {
  navigation.setViewUp(new THREE.Vector3(0, 0, 1));
  fit(new THREE.Vector3(0, -0.0001, 1).normalize());
};
$('iso').onclick = () => {
  navigation.setViewUp(new THREE.Vector3(0, 0, 1));
  fit(new THREE.Vector3(1, -1, 1).normalize());
};
function ray(e) {
  camera.updateMatrixWorld();
  const r = host.getBoundingClientRect();
  mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, (-(e.clientY - r.top) / r.height) * 2 + 1);
  const pickSize = ((camera.top - camera.bottom) / camera.zoom / host.clientHeight) * 7;
  raycaster.params.Line.threshold = raycaster.params.Points.threshold = pickSize;
  raycaster.setFromCamera(mouse, camera);
}
// Screen-space tolerance stays constant while zooming. Only cut edges intercept picks.
function selectionHit() {
  const cursor = new THREE.Vector2(
    ((mouse.x + 1) * host.clientWidth) / 2,
    ((1 - mouse.y) * host.clientHeight) / 2,
  );
  let best = null,
    distance = 7;
  const project = (p, i) => {
    const v = new THREE.Vector3().fromBufferAttribute(p, i).project(camera);
    return {
      point: new THREE.Vector2(
        ((v.x + 1) * host.clientWidth) / 2,
        ((1 - v.y) * host.clientHeight) / 2,
      ),
      z: v.z,
    };
  };
  for (const object of objects.children) {
    if (!object.visible || !object.userData.cut) continue;
    const attributes = [object.children[0].geometry.attributes.position];
    if (object.children[2]?.isLine)
      attributes.push(object.children[2].geometry.attributes.position);
    for (const p of attributes)
      for (let i = 0; i < p.count; i += 2) {
        const a = project(p, i),
          b = project(p, i + 1);
        if (Math.abs(a.z) > 1 && Math.abs(b.z) > 1) continue;
        const delta = b.point.clone().sub(a.point),
          t = delta.lengthSq()
            ? THREE.MathUtils.clamp(cursor.clone().sub(a.point).dot(delta) / delta.lengthSq(), 0, 1)
            : 0;
        const d = cursor.distanceTo(a.point.addScaledVector(delta, t));
        if (d < distance) {
          distance = d;
          best = object.userData.id;
        }
      }
  }
  return (
    best ??
    raycaster.intersectObjects(
      objects.children.filter((o) => o.visible && !o.userData.cut),
      false,
    )[0]?.object.userData.id ??
    null
  );
}
function point(e) {
  camera.updateMatrixWorld();
  ray(e);
  const r = host.getBoundingClientRect();
  tools.activeSnap = resolveSnap({
    pointer: [e.clientX - r.left, e.clientY - r.top],
    camera,
    width: r.width,
    height: r.height,
    ray: raycaster.ray,
    start: tools.first,
    z: tools.first
      ? tools.first[2]
      : tools.operation?.mode === 'rotate'
        ? tools.operation.pivot[2]
        : levelElevation(project.levels),
    model: project.objects,
    sweeps: project.objects.filter(
      (s) => isVisible(s.id) && (!isCut(s) || ui.selectedIds.has(s.id)),
    ),
    grid: { ...project.grid, z: levelElevation(project.levels) },
    referencePoints:
      referenceModels?.candidates({
        ray: raycaster.ray,
        camera,
        pointer: [e.clientX - r.left, e.clientY - r.top],
        width: r.width,
        height: r.height,
      }) || [],
    endpoints: project.snap.endpoints,
    cornerSnap: project.snap.corners,
    quadrantSnap: project.snap.quadrants,
    midpointSnap: project.snap.midpoints,
    perpendicularSnap: project.snap.perpendicular,
    gridLines: project.snap.gridLines,
    gridIntersections: project.snap.gridIntersections,
    gridStepEnabled: project.snap.gridStepEnabled,
    gridStep: project.snap.gridStep,
    axisSnap: project.snap.axes,
    polar: +project.snap.polar,
    lock: tools.axisLock,
    workPlane: drawingWorkPlane(tools.operation, tools.temporaryPlane),
    constrainToPlane: ['plateCreate', 'plateVertex'].includes(tools.operation?.mode),
  });
  if (tools.operation?.mode === 'workPlane' && tools.activeSnap.kind === 'free') {
    const hit = raycaster.intersectObjects(
      objects.children.filter((o) => o.visible && !o.userData.cut),
      false,
    )[0];
    if (hit)
      tools.activeSnap = {
        point: hit.point.toArray(),
        kind: 'point',
        symbol: 'cross',
        label: 'Objektyta',
      };
  }
  $('status').textContent =
    tools.operation?.mode === 'workPlane' ? workPlanePrompt() : tools.activeSnap.label;
  updateSnapOverlay();
  return tools.activeSnap.point;
}
function showPreview(p) {
  clearPreview();
  guide.visible = false;
  let batch;
  try {
    batch = candidates(p);
  } catch (error) {
    $('draw-length-error').textContent = error.message;
    return;
  }
  const s = batch[0];
  if (tools.operation) fillForm(s);
  else {
    ['ex', 'ey', 'ez'].forEach((k, i) => ($(k).value = p[i]));
    updateForm();
  }
  if (!batch.some((s) => validateSweep(s))) {
    $('draw-length-error').textContent = '';
    ui.previewSweep = batch.length === 1 ? s : null;
    ui.preview = previewModelBatch(batch);
    scene.add(ui.preview);
    const positions = guide.geometry.attributes.position;
    positions.setXYZ(0, ...tools.first);
    positions.setXYZ(1, ...p);
    positions.needsUpdate = true;
    guide.geometry.computeBoundingSphere();
    guide.computeLineDistances();
    guide.visible = tools.activeSnap.kind === 'direction';
    $('status').textContent =
      `${tools.activeSnap.label} · Längd ${fmt(Math.hypot(...p.map((v, i) => v - tools.first[i])))} mm`;
  }
}
function updatePointer(e) {
  tools.lastPointer = { clientX: e.clientX, clientY: e.clientY };
  if (!tools.drawing) return;
  if (tools.operation?.mode === 'workPlane') {
    const p = point(e),
      points = [...tools.operation.points, ...(p ? [p] : [])];
    let frame = null;
    if (points.length === 3) {
      try {
        frame = workPlaneFromPoints(points);
      } catch {}
    }
    workPlaneGuide.show(points, frame);
    return;
  }
  if (tools.operation?.mode === 'plateCreate' || tools.operation?.mode === 'plateVertex') {
    if (plateLengthActive() && $('draw-length').value.trim()) return;
    const p = point(e);
    if (plateLengthActive() && p) {
      const delta = p.map((v, i) => v - tools.first[i]);
      tools.lastDirection = Math.hypot(...delta) > 1e-8 ? delta : null;
    }
    if (p) previewPlatePoint(p);
    return;
  }
  if (tools.operation?.mode === 'rotate') {
    if (tools.operation.picking) {
      const p = point(e);
      if (tools.first && p) showRotationLine(tools.first, p);
    }
    return;
  }
  if (tools.first && $('draw-length').value.trim()) return;
  const p = point(e);
  clearPreview();
  guide.visible = false;
  if (!p || !tools.first) {
    tools.lastDirection = null;
    return;
  }
  const delta = p.map((v, i) => v - tools.first[i]);
  tools.lastDirection = Math.hypot(...delta) > 1e-8 ? delta : null;
  showPreview(p);
}

function orbitAroundHit(e) {
  const modified = e.ctrlKey || e.metaKey || e.shiftKey;
  const action = [
    navigation.controls.mouseButtons.LEFT,
    navigation.controls.mouseButtons.MIDDLE,
    navigation.controls.mouseButtons.RIGHT,
  ][e.button];
  const rotates =
    e.pointerType === 'touch'
      ? e.isPrimary && navigation.controls.touches.ONE === THREE.TOUCH.ROTATE
      : (!modified && action === THREE.MOUSE.ROTATE) || (modified && action === THREE.MOUSE.PAN);
  if (!rotates) return;
  ray(e);
  const hit = raycaster.intersectObjects(
    objects.children.filter((o) => o.visible && !o.userData.cut),
    false,
  )[0];
  if (!hit) return;
  navigation.movePivot(hit.point);
}
const { cancelBox, beginBox } = createSelectionController({
  host,
  renderer,
  camera,
  project,
  ui,
  getControls: () => navigation.controls,
  setDrawing,
  ray,
  select,
  selectionHit,
  setSelection,
  isVisible,
});
const { rotationHandle, rotationLine, showRotationLine, pickRotationAxis } =
  createRotationController({
    guide,
    host,
    camera,
    scene,
    renderer,
    project,
    tools,
    ui,
    objects,
    getControls: () => navigation.controls,
    isVisible,
    clearPreview,
    validateSweep,
    previewModelBatch,
    fillForm,
    setDrawing,
    checkpoint,
    render,
    syncLocks,
    syncOperationUI,
  });
const {
  updatePlateNormal,
  clearPlateOutline,
  syncPlateUI,
  fillPlate,
  startPlate,
  previewPlatePoint,
  pickPlatePoint,
  finishPlate,
  changePlateVertex,
  startPlateVertex,
} = createPlateController({
  project,
  tools,
  ui,
  scene,
  objects,
  host,
  camera,
  renderer,
  guide,
  remove,
  getInspector: () => inspector,
  select,
  setDrawing,
  syncOperationUI,
  syncMaterialPanel,
  syncLocks,
  resetLength,
  plateLengthActive,
  validateSweep,
  checkpoint,
  render,
  previewModelBatch,
  clearPreview,
  dispose,
});
const helperController = createHelperController({
  project,
  ui,
  tools,
  select,
  setDrawing,
  syncOperationUI,
  save,
  render,
  changeVisibility,
  renderer,
});
fastenerUI = new FastenerUI({
  getObjects: () => project.objects,
  getSelection: () => project.objects.filter((s) => ui.selectedIds.has(s.id)),
  finish: () => {
    inspector?.finish();
    setDrawing(false);
  },
  beginPlacement: (draft) => {
    select(null);
    setDrawing(true);
    tools.operation = { mode: 'fastenerCreate', draft };
    syncOperationUI();
    fastenerUI.sync([], tools.operation);
    inspector.show('properties');
    $('status').textContent = 'Skruv · Välj punkt under huvud, därefter riktning';
    renderer.domElement.focus({ preventScroll: true });
  },
  commit: (draft) => {
    const error = validateSweep(draft);
    if (error) throw new Error(error);
    checkpoint();
    if (draft.id) project.objects = applyObjectBatch(project.objects, [draft]).objects;
    else {
      draft = {
        ...draft,
        ...nextIdentity(draft, project.objects),
        id: crypto.randomUUID(),
        name: draft.spec.name,
      };
      project.objects = [...project.objects, draft];
    }
    setSelection([draft.id]);
    $('status').textContent = 'Skruv och hål sparade';
  },
});
installModelPointer(renderer.domElement, {
  getState: () => ({
    mode: tools.operation?.mode,
    picking: tools.operation?.picking,
    drawing: tools.drawing,
    hasStart: !!tools.first,
    boxMode: ui.boxMode,
    plateLength: plateLengthActive(),
    hasLength: !!$('draw-length').value.trim(),
  }),
  beginBox,
  orbit: orbitAroundHit,
  point,
  move: updatePointer,
  leave: () => {
    if (
      ['rotate', 'plateCreate', 'plateVertex'].includes(tools.operation?.mode) ||
      $('draw-length').value.trim()
    )
      return;
    snapMarker.hidden = true;
    tools.activeSnap = null;
    grid.highlight([]);
    guide.visible = false;
    clearPreview();
  },
  actions: {
    helperpoint: (p) => save({ type: 'helperpoint', start: p }),
    workplane: pickWorkPlane,
    plate: (p) => pickPlatePoint(p),
    rotation: pickRotationAxis,
    'plate-length': () => {
      updateTypedLength();
      if (tools.typedPoint) pickPlatePoint(tools.typedPoint, true);
    },
    length: () => {
      updateTypedLength();
      if (tools.typedPoint) commitPoint(tools.typedPoint);
    },
    select: (e) => {
      ray(e);
      select(selectionHit(), e.shiftKey);
    },
    finish: commitPoint,
    start: (p) => {
      tools.first = p;
      if (!tools.operation) {
        ['sx', 'sy', 'sz'].forEach((k, i) => ($(k).value = p[i]));
        updateForm();
      }
      $('status').textContent = tools.operation
        ? 'Välj målpunkt eller ange avstånd'
        : 'Välj slutpunkt';
      syncLocks();
      $('draw-length-form').hidden = false;
      renderer.domElement.focus({ preventScroll: true });
    },
  },
});
window.addEventListener('keydown', (e) => {
  const command = modelKeyboardCommand(e, {
    editing: ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName),
    settingsOpen: $('settings-dialog').open,
    mode: tools.operation?.mode,
    picking: tools.operation?.picking,
    hasStart: !!tools.first,
    drawing: tools.drawing,
    plateLength: plateLengthActive(),
  });
  if (!command) return;
  e.preventDefault();
  switch (command) {
    case 'cancel':
      cancelBox();
      setDrawing(false);
      break;
    case 'remove-workplane-point':
      tools.operation.points.pop();
      workPlaneGuide.show(tools.operation.points);
      $('status').textContent = workPlanePrompt();
      break;
    case 'length':
      $('draw-length').value = e.key;
      $('draw-length').focus({ preventScroll: true });
      updateTypedLength();
      break;
    case 'finish-plate':
      finishPlate();
      break;
    case 'axis':
      toggleLock(e.key.toUpperCase());
      break;
    case 'remove-plate-point':
      tools.operation.polygon.pop();
      resetLength();
      tools.operation.sidePicked = false;
      tools.first = tools.operation.polygon.length
        ? platePoint(tools.operation, tools.operation.polygon.at(-1))
        : null;
      previewPlatePoint(null);
      syncPlateUI();
      break;
    case 'angle':
      rotationHandle.input.value = e.key;
      rotationHandle.input.focus({ preventScroll: true });
      rotationHandle.input.dispatchEvent(new Event('input'));
      break;
    case 'finish-rotation':
      rotationHandle.form.requestSubmit();
      break;
    case 'undo':
    case 'redo':
      restore(command);
      break;
    case 'delete':
      remove();
      break;
  }
});
const settingsController = createSettingsController({
  project,
  checkpoint,
  onClose: () => {
    if (tools.drawing) renderer.domElement.focus({ preventScroll: true });
  },
  onGridChanged: () => {
    setDrawing(false);
    grid.set({ ...project.grid, z: levelElevation(project.levels) });
    fit();
  },
  onChange: render,
});
function fillSettings() {
  settingsController.fill();
}
function cancelInspectorPreview() {
  if (ui.inspectorPreview) {
    scene.remove(ui.inspectorPreview);
    dispose(ui.inspectorPreview);
    ui.inspectorPreview = null;
  }
  if (!tools.operation)
    objects.children.forEach((child) => (child.visible = isVisible(child.userData.id)));
}
inspector = new Inspector({
  getState: () => ({
    selected: project.objects.filter((s) => ui.selectedIds.has(s.id)),
    drawing: tools.drawing,
    operation: tools.operation,
  }),
  validate: validateSweep,
  preview: (batch) => {
    cancelInspectorPreview();
    ui.inspectorPreview = previewModelBatch(batch, false);
    scene.add(ui.inspectorPreview);
  },
  cancel: cancelInspectorPreview,
  commit: (batch) => {
    checkpoint();
    project.objects = applyObjectBatch(project.objects, batch).objects;
    render();
    $('status').textContent = 'Egenskaper uppdaterade';
  },
  fill: (batch) => {
    if (batch.length === 1) {
      fillForm(batch[0]);
      $('inspector-name').value = batch[0].name;
    } else inspector.fillCommon(batch);
  },
  remove,
});
function validateSweep(s) {
  const error = validateObject(s);
  if (error) return error;
  if (isFastener(s)) {
    try {
      validateFastenerTargets(s, project.objects);
      const model = [...project.objects.filter((old) => old.id !== s.id), s];
      for (const h of s.holes)
        geometryForModel(
          model.find((o) => o.id === h.targetId),
          model,
        ).dispose();
    } catch (e) {
      return e.message;
    }
  }
  if (!isCut(s) && !cutsForModel(s, project.objects).length) return '';
  const model = project.objects.some((old) => old.id === s.id)
    ? project.objects.map((old) => (old.id === s.id ? s : old))
    : [...project.objects, s];
  try {
    for (const target of isCut(s) ? model.filter((old) => s.targets.includes(old.id)) : [s])
      geometryForModel(target, model).dispose();
    return '';
  } catch (error) {
    return error.message;
  }
}
function previewModelBatch(batch, ghost = true) {
  const model = applyObjectBatch(
    project.objects,
    batch.filter((s) => s.id),
  ).objects;
  batch
    .filter((s) => !project.objects.some((old) => old.id === s.id))
    .forEach((s) => model.push(s));
  const affected = new Set(batch.map((s) => s.id));
  for (const s of model) {
    const old = project.objects.find((o) => o.id === s.id);
    if (isFastener(s) && (s !== old || batch.some((o) => o.id === s.id))) {
      affected.add(s.id);
      for (const h of [...s.holes, ...(old?.holes || [])]) affected.add(h.targetId);
    }
  }
  for (const s of batch)
    if (isCut(s)) {
      s.targets.forEach((id) => affected.add(id));
      project.objects.find((old) => old.id === s.id)?.targets.forEach((id) => affected.add(id));
    }
  const group = new THREE.Group();
  try {
    for (const s of model)
      if (affected.has(s.id)) group.add(mesh(s, isCut(s) || (ghost && !batch.some(isCut)), model));
  } catch (error) {
    dispose(group);
    throw error;
  }
  objects.children.forEach(
    (child) => (child.visible = isVisible(child.userData.id) && !affected.has(child.userData.id)),
  );
  return group;
}
function renderCutRelations() {
  const related = project.objects.filter(
      (s) => isCut(s) && s.targets.some((id) => ui.selectedIds.has(id)),
    ),
    cut = project.objects.find((s) => s.id === ui.selected && isCut(s));
  $('cut-relations').hidden = !related.length && !cut;
  const list = $('cut-relations-list');
  list.replaceChildren();
  $('cut-relations-title').textContent = cut ? 'Målobjekt' : 'Skärningar';
  for (const s of cut ? project.objects.filter((s) => cut.targets.includes(s.id)) : related) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = s.name;
    button.onclick = () => select(s.id);
    list.append(button);
  }
}
$('linecut').onclick = () => {
  const targets = project.objects
    .filter((s) => ui.selectedIds.has(s.id) && !isPlate(s) && isPhysical(s))
    .map((s) => s.id);
  if (targets.length) startPlate(targets, true);
};
$('polygoncut').onclick = () => {
  const targets = project.objects
    .filter((s) => ui.selectedIds.has(s.id) && isPhysical(s))
    .map((s) => s.id);
  if (targets.length) startPlate(targets);
};
function applyLibrarySection(section) {
  inspector?.finish();
  ui.libraryMode = true;
  const sources = project.objects.filter(
    (s) => ui.selectedIds.has(s.id) && !isPlate(s) && isPhysical(s),
  );
  const apply = (s) => ({
    ...s,
    profile: 'custom',
    section: structuredClone(section),
    width: section.properties.bounds.width,
    height: section.properties.bounds.height,
  });
  if (sources.length) {
    const batch = sources.map(apply),
      error = batch.map(validateSweep).find(Boolean);
    if (error) throw new Error(error);
    checkpoint();
    project.objects = applyObjectBatch(project.objects, batch).objects;
    setDrawing(false);
    if (ui.selected) fillForm(project.objects.find((s) => s.id === ui.selected));
    render();
  } else {
    startDrawing();
    ui.formSection = structuredClone(section);
    $('profile').value = 'custom';
    updateForm();
  }
  $('status').textContent = `${section.name} · version ${section.revision}`;
}
const sectionEditor = new SectionEditor(applyLibrarySection);
profilePicker = new ProfilePicker($('profile-quick-picker'), {
  profiles: () => sectionEditor.profiles,
  apply: applyLibrarySection,
});
sectionEditor.dialog.addEventListener('close', () => updateForm());
$('section-library-open').onclick = () => {
  inspector?.finish();
  sectionEditor.open();
};
$('profile-source-library').onclick = () => {
  inspector?.finish();
  ui.libraryMode = true;
  updateForm();
};
$('profile-source-form').onclick = () => {
  ui.libraryMode = false;
  if ($('profile').value !== 'custom') {
    updateForm();
    return;
  }
  inspector?.finish();
  $('profile').value = 'rect';
  $('profile').dispatchEvent(new Event('input', { bubbles: true }));
  $('profile').dispatchEvent(new Event('change', { bubbles: true }));
};
materialUI = new MaterialUI($('material-panel'), {
  apply: (patch) => {
    inspector?.finish();
    const targets = project.objects.filter((s) => ui.selectedIds.has(s.id) && isPhysical(s));
    if (targets.length) {
      checkpoint();
      const ids = new Set(targets.map((s) => s.id));
      project.objects = project.objects.map((s) =>
        ids.has(s.id) ? { ...s, ...structuredClone(patch) } : s,
      );
      render();
    } else {
      ui.draftMaterial = { ...ui.draftMaterial, ...structuredClone(patch) };
      syncMaterialPanel();
    }
  },
});
function syncMaterialPanel() {
  const selectedObjects = project.objects.filter((s) => ui.selectedIds.has(s.id) && isPhysical(s));
  const creating =
    tools.drawing &&
    !ui.selectedIds.size &&
    (!tools.operation ||
      (tools.operation.mode === 'plateCreate' && !tools.operation.cutTargets?.length));
  materialUI?.sync(
    selectedObjects.length ? selectedObjects : [ui.draftMaterial],
    !!selectedObjects.length || creating,
    !!tools.operation && tools.operation.mode !== 'plateCreate',
  );
}
const identityFields = document.createElement('div');
identityFields.id = 'identity-fields';
identityFields.className = 'dimensions';
identityFields.innerHTML =
  '<label>Prefix<input id="object-prefix" maxlength="16"></label><label>Löpnummer<input id="object-number" type="number" min="1" step="1"></label>';
$('inspector-identity').after(identityFields);
const partLabel = document.createElement('div');
partLabel.className = 'part-mark-row';
partLabel.innerHTML = '<span>Part mark</span><strong id=object-part-mark></strong>';
identityFields.append(partLabel);
$('object-prefix').parentElement.firstChild.textContent = 'Objektprefix';
identityFields.addEventListener('input', (e) => e.stopPropagation());
const commitIdentity = (e) => {
  e.stopPropagation();
  const source = project.objects.find((s) => s.id === ui.selected);
  if (!source) return;
  const updated = {
      ...source,
      prefix: $('object-prefix').value.trim().toUpperCase(),
      number: Number($('object-number').value),
    },
    error = identityError(updated, project.objects);
  $('inspector-error').textContent = error;
  if (error || (source.prefix === updated.prefix && source.number === updated.number)) return;
  inspector?.finish();
  checkpoint();
  project.objects = project.objects.map((s) => (s.id === updated.id ? updated : s));
  render();
};
identityFields.addEventListener('change', commitIdentity);
identityFields.addEventListener('focusout', commitIdentity);
identityFields.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    commitIdentity(e);
  }
});
const openPartDrawing = document.createElement('button');
openPartDrawing.id = 'inspector-open-drawing';
openPartDrawing.type = 'button';
openPartDrawing.hidden = true;
$('inspector-properties').querySelector('.panel-title').after(openPartDrawing);
function selectedPartDrawing() {
  const object =
    ui.selectedIds.size === 1 ? project.objects.find((s) => s.id === ui.selected) : null;
  if (!object || !isPhysical(object)) return null;
  const status = partStatus(object, project.objects, project.parts);
  if (!status.valid) return null;
  const record = project.drawings.find((d) => d.type === 'SP' && d.partKey === status.key);
  return record ? { ...record, sourceId: object.id } : null;
}
openPartDrawing.onclick = () => {
  inspector?.finish();
  const record = selectedPartDrawing();
  if (record) drawingManager.open(record);
  else syncIdentity();
};
function syncIdentity() {
  const root = $('identity-fields');
  if (!root) return;
  const s = project.objects.find((s) => s.id === ui.selected);
  root.hidden = !s;
  root.inert = !!tools.operation;
  const shortcut = $('inspector-open-drawing'),
    record = selectedPartDrawing();
  if (shortcut) {
    shortcut.hidden = !record;
    shortcut.disabled = !!tools.operation;
    shortcut.textContent = record ? `Öppna ritning · ${record.number}` : 'Öppna ritning';
  }
  if (s) {
    $('object-part-mark').textContent = !isPhysical(s)
      ? ''
      : partStatus(s, project.objects, project.parts).label;
    $('object-prefix').value = s.prefix || '';
    $('object-number').value = s.number || '';
  }
}
function changeVisibility(action) {
  inspector?.finish();
  setDrawing(false);
  action();
  ui.selectedIds = new Set([...ui.selectedIds].filter(isVisible));
  ui.selected = ui.selectedIds.size === 1 ? [...ui.selectedIds][0] : null;
  render();
}
modelTree = new ModelTree($('object-list'), {
  select: (id, add) => {
    hiddenObjects.delete(id);
    if (isHelper(project.objects.find((s) => s.id === id))) ui.showHelpers = true;
    select(id, add, true);
  },
  visible: isVisible,
  toggle: (id) =>
    changeVisibility(() => {
      if (isVisible(id)) hiddenObjects.add(id);
      else {
        hiddenObjects.delete(id);
        if (isHelper(project.objects.find((s) => s.id === id))) ui.showHelpers = true;
      }
    }),
  isolate: () => {
    const ids = new Set(ui.selectedIds);
    changeVisibility(() => {
      hiddenObjects.clear();
      project.objects.forEach((s) => {
        if (!ids.has(s.id)) hiddenObjects.add(s.id);
      });
    });
  },
  showAll: () =>
    changeVisibility(() => {
      hiddenObjects.clear();
      ui.showHelpers = true;
    }),
});
levelsUI = new LevelsUI({
  getState: () => project.levels,
  change: (next) => {
    inspector?.finish();
    checkpoint();
    setDrawing(false);
    project.levels = next;
    grid.set({ ...project.grid, z: levelElevation(project.levels) });
    levelsUI.sync();
    if (!ui.selectedIds.size) {
      $('sz').value = levelElevation(project.levels);
      $('ez').value = levelElevation(project.levels);
      updateForm();
    }
    render();
    $('status').textContent =
      'Aktiv nivå: ' + project.levels.items.find((l) => l.id === project.levels.active).name;
  },
});
const drawingController = createDrawingController({
  project,
  checkpoint,
  getSelection: () => ui.selectedIds,
  finishEditing: () => inspector?.finish(),
  stopTool: () => setDrawing(false),
  highlight: (ids) => {
    ids.forEach((id) => hiddenObjects.delete(id));
    setSelection(ids, true);
  },
  onChange: render,
  onIdentityChange: syncIdentity,
});
planView = drawingController.planView;
drawingManager = drawingController.manager;
createGroupedToolbox(document.querySelector('.toolbox'));
updateForm();
render();
navigation.controls.update();
fit();
syncLocks();

const frameEditor = new FrameEditor({
  getContext: () => ({
    project: project.info,
    drawings: project.drawings.map((d) => drawingAttributeContext(d, project).drawing),
  }),
  beforeOpen: () => {
    inspector?.finish();
    setDrawing(false);
  },
});

installDrawingSettings(drawingController, frameEditor);
setupPWA();

referenceModels = new ReferenceModels({
  scene,
  inspector,
  fit: (bounds) => fit(undefined, bounds),
  status: (text) => {
    document.querySelector('footer [role=status]').textContent = text;
  },
});
