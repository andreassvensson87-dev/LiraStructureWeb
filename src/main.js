import { createGridModelEditor } from './app/grid-model-editor.js';
import { installDrawingTemplates } from './install-drawing-templates.js';
import { installReports } from './report-module.js';
import { installNumbering } from './numbering/ui.js';
import {
  installReportTemplates,
  installMaterialReportTemplate,
  installFullFrameReportTables,
} from './install-report-templates.js';
import { installTeklaAttributeChoices } from './install-tekla-attribute-choices.js';
import { openDrawingAttributeLibrary } from './drawing-attribute-library.js';
try {
  installDrawingTemplates();
  installReportTemplates();
  installMaterialReportTemplate();
  installFullFrameReportTables();
  installTeklaAttributeChoices();
} catch (error) {
  console.warn('Kunde inte installera ritningsmallarna.', error);
}
import {
  copyPlateProperties,
  editablePlate,
  loadPlateDefaults,
  storePlateDefaults,
} from './model/plate-properties.js';
let platePropertyUI = null;
let lastPlateDefaults = loadPlateDefaults(localStorage);
import {
  copySweepProperties,
  editableSweep,
  loadSweepDefaults,
  storeSweepDefaults,
} from './model/sweep-properties.js';
import { createObjectPropertyUI } from './inspector/object-property-ui.js';
import { objectInspectorSchemas } from './inspector/object-schemas.js';
let sweepPropertyUI = null;
let lastSweepDefaults = loadSweepDefaults(localStorage);
import { componentDeletion, componentTransformSources } from './components/ownership.js';
import { ObjectFeedback } from './model/object-feedback.js';
import { createConnectionMarkers } from './components/markers.js';
import { createComponentUI } from './components/ui.js';
let componentUI = null;
import { updateDisplayDetail } from './model/display-detail.js';
import { ReferenceModels } from './references/reference-models.js';
import { moveReferencePlacement } from './references/reference-placement.js';
import { drawingAttributeContext } from './drawing-attributes.js';
import { installDrawingSettings } from './drawing-settings.js';
import { setupPWA } from './app/pwa.js';
import { moveGripPoints } from './model/grips.js';
import { createGroupedToolbox } from './model/ui/toolbox.js';
import { createHelperController } from './model/ui/helper-controller.js';
import { isHelper, isPhysical } from './model-object.js';
import { FastenerUI } from './fasteners/ui.js';
import { isFastener } from './fasteners/object-type.js';
import { resolveFastenerHoles } from './fasteners/placement.js';
import { axisPlacement } from './fasteners/geometry.js';
import {
  alignFastenerGroup,
  fastenerGroupBatch,
  replaceFastenerGroup,
} from './fasteners/groups.js';
import { groupSelection } from './fasteners/group-data.js';
import {
  removeFastenerRelations,
  validateFastenerTargets,
  holesByTarget,
} from './fasteners/relations.js';
import { updateAutomaticJoints } from './fasteners/update-joints.js';
let fastenerUI = null;
import { typeName } from './object-identity.js';
import { createSweepForm } from './model/ui/sweep-form.js';
import { createWorkplaneController } from './model/ui/workplane-controller.js';
import { createRotationController } from './model/ui/rotation-controller.js';
import { createSelectionController } from './model/ui/selection-controller.js';
import { createPlateController } from './model/ui/plate-controller.js';
import { createModelEditorState } from './model/editor-state.js';
import { hasExactProfile, setModelProfilesExact } from './profile-detail.js';
const ui = createModelEditorState();
import { createToolSession, resetToolLength, resetToolInteraction } from './model/tool-session.js';
const tools = createToolSession();
import { createSettingsController } from './app/settings-controller.js';

import { transformCandidates, applyObjectBatch } from './model/tools/transform-tool.js';
import { installModelPointer } from './model/pointer-controller.js';
import { modelKeyboardCommand } from './model/keyboard-command.js';
import { stepSweepPlacement, quarterTurnSweep } from './model/sweep-shortcuts.js';
import {
  createObjectMesh,
  updateObjectMeshSelection,
  updateObjectMeshTransparency,
} from './model/object-mesh.js';
import { createProject, captureProject } from './project/project-state.js';
import { addToAssembly } from './project/assemblies.js';
import { installProjectFiles } from './app/project-files.js';
import { SnapIndex } from './model/snap-index.js';
import {
  displayGeometryIdentityReader,
  createDisplayGeometryContext,
  selectionGeometryReader,
} from './model-object.js';
import { InstanceBatches } from './model/instance-batches.js';
import { reconcileChildren } from './model/reconcile-children.js';
import { InteractionTimings } from './model/interaction-timings.js';
const interactionTimings = new InteractionTimings(
  import.meta.env.DEV && new URLSearchParams(location.search).get('performance') === '1',
);
if (interactionTimings.enabled)
  document.addEventListener(
    'click',
    (event) => {
      if (event.target.closest('form.fastener-editor button[type="submit"], #undo, #redo'))
        interactionTimings.begin(
          event.target.closest('#undo')
            ? 'undo'
            : event.target.closest('#redo')
              ? 'redo'
              : 'jointEdit',
        );
    },
    { capture: true },
  );
import { FrameGate } from './model/frame-gate.js';
import { updateFastenerDetail } from './model/fastener-detail.js';
import { createFrameExample } from './project/frame-example.js';
import { ProjectHistory } from './project/project-history.js';
import { FrameEditor } from './frame-editor.js';
import { workPlaneFromPoints, drawingWorkPlane } from './work-plane.js';

import { partStatus } from './part-marks.js';
import { createDrawingController } from './app/drawing-controller.js';
let drawingManager = null;

let planView = null;

import { LevelsUI, initialLevels, levelElevation } from './levels.js';
let levelsUI = null;
import { nextIdentity, identityError, designation } from './object-identity.js';
import { ModelFilter } from './model-filter-ui.js';
let modelFilter = null;
import { ModelTree } from './model-tree.js';
let modelTree = null;
let referenceModels = null;
const hiddenObjects = new Set();
const baseVisible = (id) =>
  !hiddenObjects.has(id) &&
  (ui.showHelpers ||
    !isHelper(renderedById.get(id)?.source ?? project.objects.find((s) => s.id === id)));
const isVisible = (id) => baseVisible(id) && (modelFilter?.allows(id) ?? true);
import { MaterialUI } from './material-ui.js';
import { profileMaterialSuggestions, suggestedProfileMaterial } from './profile-material.js';
import { ObjectInformation } from './model/ui/object-information.js';
let materialUI = null;
import './style.css';
import './cad-statusbar.css';
import './drawing-editor-header.css';
import './drawing-view-grips.css';

import { ProfilePicker } from './profile-picker.js';
let profilePicker = null;
import { SectionEditor } from './section-editor.js';

import { isLineCut } from './line-cut.js';
import { Inspector } from './inspector.js';
let inspector = null;
let gridEditor = null;
import * as THREE from 'three';
import { createModelViewport } from './model/viewport.js';

import { InsertionPoints } from './insertion-points.js';
import { endpointAtLength } from './length-input.js';
import { resolveSnap } from './snap.js';
import { GridLines, defaultGrid } from './grid-lines.js';

import { isCut, cutsForModel, displayGeometry, isPlate, validateObject } from './model-object.js';
import { platePoint, plateNormal } from './plate.js';
const $ = (id) => document.getElementById(id),
  fmt = (n) => n.toLocaleString('sv-SE', { maximumFractionDigits: 3 });

const host = $('viewport');
const { scene, camera, renderer, navigation, viewWidget } = createModelViewport(host, (message) => {
  $('status').textContent = message;
});
const project = createProject({ grid: defaultGrid, levels: initialLevels() });
const projectHistory = new ProjectHistory();

const grid = new GridLines(scene, host);
grid.set({ ...project.grid, z: levelElevation(project.levels) });
const objects = new THREE.Group();
scene.add(objects);
const connectionMarkers = createConnectionMarkers(host, (id) => {
  if (tools.operation?.mode === 'componentProperties')
    componentUI.pickCopy(project.objects.find((s) => s.id === id));
  else setSelection([id]);
});
const instanceBatches = new InstanceBatches(scene);
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
raycaster.layers.enable(3);

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
    } else if (!tools.operation?.referenceId) {
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
  if (!gridEditor?.active) grid.highlight(tools.drawing ? tools.activeSnap?.gridIds : []);
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

let pendingPointer = null;
const frameGate = new FrameGate();
const objectFeedback = new ObjectFeedback(scene, {
  visible: isVisible,
  invalidate: () => frameGate.invalidate(),
});
objectFeedback.setModel(project.objects);
for (const event of ['click', 'input', 'change', 'keydown', 'pointerup', 'pointercancel'])
  document.addEventListener(event, () => frameGate.invalidate(), { capture: true });
host.addEventListener(
  'pointermove',
  () => {
    if (tools.drawing || tools.operation || ui.preview || rotationHandle.drag)
      frameGate.invalidate();
  },
  { capture: true },
);
host.addEventListener('pointerleave', () => frameGate.invalidate());
new ResizeObserver(() => frameGate.invalidate()).observe(host);
renderer.setAnimationLoop(() => {
  if (pendingPointer) {
    const pointer = pendingPointer;
    pendingPointer = null;
    updateObjectHover(pointer);
    updatePointer(pointer);
  }
  if (!ui.marquee && !rotationHandle.drag) navigation.controls.update();
  // Project labels with the same camera transform used to render this frame.
  camera.updateMatrixWorld();
  if (!frameGate.consume(camera)) return;
  if (modelFilter?.filter.inView) {
    const previous = [...modelFilter.matches].join('|');
    modelFilter.sync(project);
    if ([...modelFilter.matches].join('|') !== previous) {
      ui.selectedIds = new Set([...ui.selectedIds].filter(isVisible));
      ui.selected = ui.selectedIds.size === 1 ? [...ui.selectedIds][0] : null;
      render();
    }
  }
  const frameStarted = performance.now();
  updateFastenerDetail(objects.children, camera, host.clientHeight, ui.selectedIds);
  updateDisplayDetail(objects.children, camera, host.clientHeight, ui.selectedIds);
  instanceBatches.sync(camera);
  objectFeedback.refresh();
  viewWidget.update();
  connectionMarkers.update(camera);
  grid.updateLabels(camera, host.clientWidth, host.clientHeight);
  gridEditor?.update();
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
  interactionTimings.record('framePreparationMs', frameStarted);
  interactionTimings.measure('webglSubmissionMs', () => renderer.render(scene, camera));
  interactionTimings.frameSubmitted(project.objects.length);
  if (import.meta.env.DEV) {
    host.dataset.renderCalls = renderer.info.render.calls;
    host.dataset.renderMs = (performance.now() - frameStarted).toFixed(1);
  }
});

const { readForm, fillForm, updateForm } = createSweepForm({
  project,
  tools,
  ui,
  getProfilePicker: () => profilePicker,
  getInspector: () => inspector,
  fillPlate: (s) => fillPlate(s),
  save,
  updateTypedLength,
  updatePointer,
  clearPreview,
  remember: () => {
    if (
      !ui.selected &&
      !tools.operation &&
      ['width', 'height', 'rotation'].every((id) => $(id).value.trim())
    )
      rememberSweep({ ...readForm(), ...ui.draftMaterial });
  },
});
function dispose(o) {
  o.traverse((child) => {
    child.geometry?.dispose();
    if (child.material) child.material.dispose();
  });
}
function clearPreview() {
  referenceModels?.clearPlacementPreview();
  ui.componentPreview = false;
  objectFeedback.setModel(project.objects);
  objects.children.forEach((child) => (child.visible = isVisible(child.userData.id)));
  ui.previewSweep = null;
  if (ui.preview) {
    scene.remove(ui.preview);
    dispose(ui.preview);
    ui.preview = null;
  }
}
function mesh(s, ghost = false, model = project.objects, geometryContext = null) {
  return createObjectMesh(s, {
    model,
    geometryContext,
    profileDetail: ui.exactProfileIds.has(s.id) ? 'exact' : 'schematic',
    selectedIds:
      tools.operation?.mode === 'fastenerTargets'
        ? new Set(tools.operation.targetIds)
        : ui.selectedIds,
    transparentView: ui.transparentView,
    ghost,
  });
}
let renderedObjects = [];
let renderedById = new Map();
let renderedSelection = new Set();
let snapIndex = null;
function render({ selectionOnly = false } = {}) {
  const renderStarted = performance.now();
  modelFilter?.sync(project);
  frameGate.invalidate();
  selectionOnly &&=
    project.objects.length === renderedObjects.length &&
    project.objects.every((s, i) => s === renderedObjects[i]);
  const selectedIds =
    tools.operation?.mode === 'fastenerTargets'
      ? new Set(tools.operation.targetIds)
      : ui.selectedIds;
  if (selectionOnly) {
    for (const id of new Set([...renderedSelection, ...selectedIds])) {
      if (renderedSelection.has(id) === selectedIds.has(id)) continue;
      const entry = renderedById.get(id);
      if (entry) updateObjectMeshSelection(entry.child, entry.source, selectedIds);
    }
  } else {
    instanceBatches.prepareRebuild();
    const previous = renderedById;
    const profileOptions = { exactProfileIds: ui.exactProfileIds };
    const geometry = displayGeometryIdentityReader(project.objects, profileOptions);
    const holes = holesByTarget(project.objects);
    const geometryContext = createDisplayGeometryContext(project.objects, profileOptions);
    const children = [];
    let reused = 0;
    renderedById = new Map();
    for (const s of project.objects) {
      const old = previous.get(s.id);
      const reuse =
        old?.source === s &&
        old.child.userData.transparentView === ui.transparentView &&
        old.child.userData.geometryIdentity === geometry(s) &&
        (old.child.userData.holes || []).length === (holes.get(s.id) || []).length &&
        (old.child.userData.holes || []).every((h, i) => h === holes.get(s.id)?.[i]);
      const child = reuse ? old.child : mesh(s, false, project.objects, geometryContext);
      if (reuse) {
        reused++;
        updateObjectMeshSelection(child, s, selectedIds);
      }
      renderedById.set(s.id, { child, source: s });
      child.visible =
        isVisible(s.id) &&
        (tools.operation?.mode !== 'rotate' ||
          tools.operation.picking ||
          !ui.selectedIds.has(s.id));
      children.push(child);
    }
    for (const [id, entry] of previous)
      if (renderedById.get(id)?.child !== entry.child) dispose(entry.child);
    reconcileChildren(objects, children);
    renderedObjects = [...project.objects];
    instanceBatches.update(objects.children);
    interactionTimings.record('meshesAndBatchesMs', renderStarted);
    snapIndex = interactionTimings.measure('snapIndexMs', () => new SnapIndex(project.objects));
    if (import.meta.env.DEV) {
      host.dataset.reusedMeshes = reused;
      host.dataset.createdMeshes = children.length - reused;
    }
  }
  renderedSelection = new Set(selectedIds);
  $('count').textContent = project.objects.length;
  interactionTimings.measure('modelTreeMs', () => {
    if (selectionOnly) modelTree?.setSelection(ui.selectedIds);
    else modelTree?.render(project.objects, ui.selectedIds, project.assemblies);
  });
  interactionTimings.measure('identityMs', syncIdentity);
  const uiStarted = performance.now();
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
  componentUI?.sync();
  sweepPropertyUI?.sync();
  platePropertyUI?.sync();
  objectFeedback.setSelection(ui.selectedIds);
  objectFeedback.setModel(project.objects);
  connectionMarkers.sync(
    project.objects,
    ui.selectedIds,
    isVisible,
    tools.operation?.mode === 'fit',
  );
  fastenerUI?.sync(
    project.objects.filter((s) => ui.selectedIds.has(s.id)),
    tools.operation,
  );
  if (!selectionOnly) {
    planView?.sync();
    if (drawingManager?.dialog.open) drawingManager.render();
  }
  interactionTimings.record('otherUiMs', uiStarted);
}
function setSelection(ids, keepTab = false) {
  referenceModels?.clearObjectSelection();
  inspector?.rollback();
  setDrawing(false);
  ui.selectedIds = groupSelection(project.objects, ids);
  ui.selected = ui.selectedIds.size === 1 ? [...ui.selectedIds][0] : null;
  if (ui.selected) fillForm(project.objects.find((s) => s.id === ui.selected));
  render({ selectionOnly: true });
  if (ui.selectedIds.size && !keepTab) inspector.show('properties');
}
function select(id, additive = false, keepTab = false) {
  const ids = additive ? new Set(ui.selectedIds) : new Set();
  if (id) {
    if (additive && ids.has(id)) {
      for (const memberId of groupSelection(project.objects, [id])) ids.delete(memberId);
    } else ids.add(id);
  }
  setSelection(ids, keepTab);
}
function selectModelOrReference(id, additive = false) {
  const reference = !id && referenceModels?.pickReference(raycaster);
  if (reference) {
    setSelection([], true);
    if (reference.ifcId != null) referenceModels.selectObject(reference);
    else referenceModels.showModel(reference.modelId);
    inspector.show('references');
    frameGate.invalidate();
  } else select(id, additive);
}
function checkpoint() {
  projectHistory.checkpoint(project);
}
function save(s) {
  if (ui.selected) s = { ...project.objects.find((o) => o.id === ui.selected), ...s };
  const error = validateSweep(s);
  if (error) {
    $('error').textContent = error;
    $('inspector-error').textContent = error;
    return false;
  }
  let edited;
  if (ui.selected) {
    try {
      edited = applyObjectBatch(project.objects, [s]).objects;
    } catch (error) {
      $('inspector-error').textContent = $('error').textContent = error.message;
      return false;
    }
  }
  checkpoint();
  if (ui.selected) {
    project.objects = edited;
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
  rememberSweep(project.objects.find((o) => o.id === ui.selected));
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
  const removedIds = componentDeletion(project.objects, ui.selectedIds);
  let next = removeFastenerRelations(project.objects, removedIds)
    .map((s) => (isCut(s) ? { ...s, targets: s.targets.filter((id) => !removedIds.has(id)) } : s))
    .filter((s) => !isCut(s) || s.targets.length);
  try {
    next = updateAutomaticJoints(project.objects, next);
  } catch (error) {
    $('status').textContent = $('inspector-error').textContent = error.message;
    return;
  }
  checkpoint();
  project.objects = next;
  ui.selected = null;
  ui.selectedIds.clear();
  clearPreview();
  render();
  $('status').textContent = 'Markeringen borttagen';
}
$('delete').onclick = $('multi-delete').onclick = remove;
function restore(direction) {
  gridEditor?.cancelDrag();
  const next = interactionTimings.measure('historyRestoreMs', () =>
    projectHistory[direction](project),
  );
  if (!next) return;
  Object.assign(project, next);
  referenceModels?.restore(project.references);
  levelsUI?.sync();
  fillSettings();
  grid.set({ ...project.grid, z: levelElevation(project.levels) });
  select(null);
  gridEditor?.refresh();
  $('status').textContent = 'Modellen återställd';
}
$('undo').onclick = () => restore('undo');
$('redo').onclick = () => restore('redo');
function setDrawing(value) {
  objectFeedback.clearHover();
  componentUI?.cancel();
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
  navigation.controls.mouseButtons.LEFT = null;
  navigation.controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
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
  componentUI?.sync();
  sweepPropertyUI?.sync();
  platePropertyUI?.sync();
  objectFeedback.setSelection(ui.selectedIds);
  objectFeedback.setModel(project.objects);
  connectionMarkers.sync(
    project.objects,
    ui.selectedIds,
    isVisible,
    tools.operation?.mode === 'fit',
  );
  fastenerUI?.sync(
    project.objects.filter((s) => ui.selectedIds.has(s.id)),
    tools.operation,
  );
}
function rememberPlate(source) {
  if (!editablePlate(source)) return;
  try {
    lastPlateDefaults = storePlateDefaults(localStorage, source);
  } catch {
    /* Preserve the last valid plate properties. */
  }
}
function restorePlateDefaults() {
  if (!lastPlateDefaults) return;
  $('plate-thickness').value = lastPlateDefaults.thickness;
  $('plate-side').value = lastPlateDefaults.side;
  $('plate-contour-offset').value = lastPlateDefaults.contourOffset;
  ui.draftMaterial = {
    material: structuredClone(lastPlateDefaults.material),
    colorOverride: lastPlateDefaults.colorOverride,
  };
  ui.draftMaterialAutomatic = !lastPlateDefaults.material;
}
function rememberSweep(source) {
  if (!editableSweep(source)) return;
  try {
    lastSweepDefaults = storeSweepDefaults(localStorage, source);
  } catch {
    /* Invalid drafts do not replace the last usable properties. */
  }
}
function restoreSweepDefaults() {
  if (!lastSweepDefaults) return;
  const current = readForm();
  ui.draftMaterial = {
    material: lastSweepDefaults.material ?? null,
    colorOverride: lastSweepDefaults.colorOverride ?? null,
  };
  ui.draftMaterialAutomatic = !lastSweepDefaults.material;
  fillForm({ ...lastSweepDefaults, type: 'sweep', start: current.start, end: current.end });
}
function startDrawing() {
  inspector?.finish();
  if (ui.selected) rememberSweep(project.objects.find((o) => o.id === ui.selected));
  select(null);
  restoreSweepDefaults();
  setDrawing(true);
  inspector.show('properties');
}
function syncOperationUI() {
  for (const id of ['move', 'copy', 'rotate']) {
    $(id).disabled =
      !ui.selectedIds.size && !(id !== 'copy' && referenceModels?.transformSelection());
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
  const reference = mode === 'move' && referenceModels?.transformSelection();
  if (reference) {
    setDrawing(true);
    tools.operation = {
      mode,
      referenceId: reference.id,
      placement: structuredClone(reference.placement),
    };
    syncOperationUI();
    $('status').textContent = 'Flytta referens · Välj baspunkt';
    renderer.domElement.focus({ preventScroll: true });
    return;
  }
  const sources = componentTransformSources(project.objects, ui.selectedIds);
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
  const ids = groupSelection(
    project.objects,
    grip.refs.map((r) => r.id),
  );
  const sources = structuredClone(componentTransformSources(project.objects, ids));
  setDrawing(true);
  tools.operation = sources.some(
    (s) =>
      s.group ||
      ['baseplate', 'stiffener', 'endplate', 'boltedEndplate', 'beamSplice'].includes(s.kind),
  )
    ? { mode: 'move', sources }
    : { mode: 'grip', sources, refs: grip.refs };
  $('status').textContent = 'Flytta insättningspunkter · Välj målpunkt eller ange avstånd';
  tools.first = [...grip.point];
  syncOperationUI();
  syncLocks();
  $('draw-length-form').hidden = false;
  renderer.domElement.focus({ preventScroll: true });
}
function candidates(target) {
  if (tools.operation?.mode === 'fastenerCreate') {
    const draft = tools.operation.draft;
    if (draft.group)
      return fastenerGroupBatch(alignFastenerGroup(draft, tools.first, target), project.objects, {
        fit: false,
      });
    return [
      {
        ...draft,
        ...axisPlacement(draft.spec, tools.first, target),
        ...(draft.placementMode === 'range'
          ? {
              insertion: {
                start: [...tools.first],
                direction: [...target],
                depth: draft.drillDepth,
              },
            }
          : {}),
      },
    ];
  }
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
  if (tools.operation?.referenceId) {
    const { referenceId, placement } = tools.operation;
    const next = moveReferencePlacement(placement, tools.first, target);
    clearPreview();
    checkpoint();
    referenceModels.setPlacement(referenceId, next);
    setDrawing(false);
    render();
    $('status').textContent = 'Referensen flyttad';
    return true;
  }
  let batch;
  try {
    batch = candidates(target);
    if (
      tools.operation?.mode === 'fastenerCreate' &&
      tools.operation.draft.placementMode === 'range'
    ) {
      clearPreview();
      tools.first = null;
      tools.operation = { mode: 'fastenerDepth', draft: batch[0] };
      $('draw-length-form').hidden = true;
      fastenerUI.sync([], tools.operation);
      inspector.show('properties');
      $('status').textContent = batch[0].group
        ? 'Kontrollera skruvgruppen · Enter skapar gruppen och dess hål'
        : 'Kontrollera förbandet · Enter skapar skruv och hål';
      fastenerUI.placeForm.querySelector('[type=submit]').focus();
      return true;
    }
    if (tools.operation?.mode === 'fastenerCreate')
      batch = batch.map((s) => resolveFastenerHoles(s, project.objects));
  } catch (error) {
    $('draw-length-error').textContent = error.message;
    $('status').textContent = error.message;
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
    let result;
    try {
      result = applyObjectBatch(project.objects, batch, { copy: mode === 'copy' });
    } catch (error) {
      $('draw-length-error').textContent = $('status').textContent = error.message;
      return false;
    }
    checkpoint();
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
  for (const object of objects.children) updateObjectMeshTransparency(object, ui.transparentView);
  instanceBatches.setTransparentView(ui.transparentView);
  frameGate.invalidate();
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
  const projectToScreen = (p, i) => {
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
    if (tools.operation?.mode === 'fastenerTargets') continue;
    if (!object.visible || !object.userData.cut || object.userData.component) continue;
    const attributes = [object.children[0].geometry.attributes.position];
    if (object.children[2]?.isLine)
      attributes.push(object.children[2].geometry.attributes.position);
    for (const p of attributes)
      for (let i = 0; i < p.count; i += 2) {
        const a = projectToScreen(p, i),
          b = projectToScreen(p, i + 1);
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
      objects.children.filter(
        (o) =>
          o.visible &&
          (camera.layers.test(o.layers) || o.userData.instanced) &&
          !o.userData.cut &&
          (tools.operation?.mode !== 'fastenerTargets' ||
            (isPhysical(renderedById.get(o.userData.id)?.source) &&
              renderedById.get(o.userData.id)?.source.type !== 'fastener')),
      ),
      false,
    )[0]?.object.userData.id ??
    null
  );
}
function point(e) {
  camera.updateMatrixWorld();
  ray(e);
  const r = host.getBoundingClientRect();
  const snapStarted = performance.now();
  const snapObjects = (
    snapIndex?.query(camera, r.width, r.height, [e.clientX - r.left, e.clientY - r.top]) ??
    project.objects
  ).filter((s) => isVisible(s.id) && (!isCut(s) || ui.selectedIds.has(s.id)));
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
    geometryContext: snapIndex?.nearbyContext(
      camera,
      r.width,
      r.height,
      [e.clientX - r.left, e.clientY - r.top],
      tools.first,
      project.snap.midpoints,
      project.snap.perpendicular,
    ),
    sweeps: snapObjects,
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
  if (import.meta.env.DEV) {
    host.dataset.snapObjects = snapObjects.length;
    host.dataset.snapMs = (performance.now() - snapStarted).toFixed(1);
  }
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
  if (tools.operation?.referenceId) {
    referenceModels.previewPlacement(
      tools.operation.referenceId,
      moveReferencePlacement(tools.operation.placement, tools.first, p),
    );
    frameGate.invalidate();
    return;
  }
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
  if (['fastenerTargets', 'fastenerDepth', 'fit'].includes(tools.operation?.mode)) return;
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
  select: selectModelOrReference,
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
    getReference: () => referenceModels?.transformSelection(),
    previewReference: (id, placement) => {
      referenceModels.previewPlacement(id, placement);
      frameGate.invalidate();
    },
    commitReference: (id, placement) => referenceModels.setPlacement(id, placement),
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
  remember: rememberPlate,
  restoreDefaults: restorePlateDefaults,
  syncPropertyUI: () => {
    sweepPropertyUI?.sync();
    platePropertyUI?.sync();
  },
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
  selectSource: (id) => setSelection(id ? [id] : []),
  getOperation: () => tools.operation,
  previewPlacement: (draft) => {
    clearPreview();
    if (!draft) return;
    ui.preview = previewModelBatch(Array.isArray(draft) ? draft : [draft]);
    scene.add(ui.preview);
  },
  showInspector: () => inspector.show('properties'),
  beginTargets: (targetIds, group = false) => {
    select(null);
    setDrawing(true);
    tools.operation = { mode: 'fastenerTargets', targetIds };
    render();
    inspector.show('properties');
    $('status').textContent =
      `${group ? 'Skruvgrupp' : 'Skruv'} · Klicka på delar, Enter bekräftar, Escape avbryter`;
    renderer.domElement.focus({ preventScroll: true });
  },
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
    const label = draft.group ? 'Skruvgrupp' : 'Skruv';
    $('status').textContent =
      draft.placementMode === 'range'
        ? `${label} · Välj första insättningspunkten, därefter riktning`
        : `${label} · Välj punkt under huvud, därefter riktning`;
    renderer.domElement.focus({ preventScroll: true });
  },
  commit: commitFastener,
});
function commitFastener(draft) {
  if (draft.group) {
    const batch = fastenerGroupBatch(draft, project.objects);
    const known = new Set(project.objects.map((s) => s.id));
    const identified = [];
    for (const s of batch) {
      identified.push(
        known.has(s.id)
          ? s
          : {
              ...s,
              ...nextIdentity(s, [...project.objects, ...identified]),
              name: `${s.spec.name} · ${s.group.row + 1}:${s.group.column + 1}`,
            },
      );
    }
    const next = updateAutomaticJoints(
      project.objects,
      replaceFastenerGroup(project.objects, identified),
    );
    checkpoint();
    project.objects = next;
    setSelection(identified.map((s) => s.id));
    $('status').textContent = `Skruvgrupp sparad · ${identified.length} skruvar med kopplade hål`;
    return;
  }
  const error = interactionTimings.measure('validationMs', () => validateSweep(draft));
  if (error) throw new Error(error);
  const updated = interactionTimings.measure('transactionMs', () =>
    draft.id ? applyObjectBatch(project.objects, [draft]).objects : null,
  );
  interactionTimings.measure('historyMs', checkpoint);
  if (draft.id) project.objects = updated;
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
}
const assemblyMenu = document.createElement('div');
assemblyMenu.className = 'annotation-context-menu model-context-menu';
assemblyMenu.hidden = true;
assemblyMenu.setAttribute('role', 'menu');
const addAssemblyButton = document.createElement('button');
addAssemblyButton.type = 'button';
addAssemblyButton.setAttribute('role', 'menuitem');
addAssemblyButton.textContent = 'Lägg till i assembly';
assemblyMenu.append(addAssemblyButton);
const profileMenuButton = (label, action) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('role', 'menuitem');
  button.textContent = label;
  button.onclick = () => {
    assemblyMenu.hidden = true;
    action();
    render();
  };
  assemblyMenu.append(button);
  return button;
};
const objectInformation = new ObjectInformation({
  getObjects: () => project.objects.filter((s) => ui.selectedIds.has(s.id)),
  getModel: () => project.objects,
  partLabel: (s) => (isPhysical(s) ? partStatus(s, project.objects, project.parts).label : '—'),
});
const informationButton = profileMenuButton('Information', () => {
  inspector?.finish();
  objectInformation.open();
});
const showExactButton = profileMenuButton('Visa exakt', () => {
  setModelProfilesExact(ui, project.objects, ui.selectedIds, true);
  $('status').textContent = 'Markerade profiler visas exakt med radier';
});
const showSchematicButton = profileMenuButton('Visa schematiskt', () => {
  setModelProfilesExact(ui, project.objects, ui.selectedIds, false);
  $('status').textContent = 'Markerade profiler visas schematiskt utan radier';
});
const redrawViewButton = profileMenuButton('Rita om vyn', () => {
  ui.exactProfileIds.clear();
  $('status').textContent = 'Vyn omritad · alla profiler visas schematiskt';
});
redrawViewButton.title = 'Återställ alla profiler i modellen till schematisk visning';
document.body.append(assemblyMenu);
renderer.domElement.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  if (tools.drawing || tools.operation) return;
  const selected = project.objects.filter((s) => ui.selectedIds.has(s.id));
  informationButton.disabled = !selected.length;
  const profiles = selected.filter(hasExactProfile);
  showExactButton.disabled =
    !profiles.length || profiles.every((s) => ui.exactProfileIds.has(s.id));
  showSchematicButton.disabled = !profiles.some((s) => ui.exactProfileIds.has(s.id));
  addAssemblyButton.disabled = !selected.length || selected.some((s) => !isPhysical(s));
  assemblyMenu.hidden = false;
  assemblyMenu.style.left = `${Math.max(0, Math.min(event.clientX, innerWidth - assemblyMenu.offsetWidth))}px`;
  assemblyMenu.style.top = `${Math.max(0, Math.min(event.clientY, innerHeight - assemblyMenu.offsetHeight))}px`;
  addAssemblyButton.focus();
});
// Capture outside presses before model selection consumes the pointer event.
document.addEventListener(
  'pointerdown',
  (event) => {
    if (!assemblyMenu.contains(event.target)) assemblyMenu.hidden = true;
  },
  true,
);
assemblyMenu.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.stopPropagation();
    assemblyMenu.hidden = true;
    renderer.domElement.focus({ preventScroll: true });
  }
});
addAssemblyButton.onclick = () => {
  inspector?.finish();
  const secondaryIds = [...ui.selectedIds];
  assemblyMenu.hidden = true;
  setDrawing(false);
  tools.operation = { mode: 'assemblyMain', secondaryIds };
  syncOperationUI();
  renderer.domElement.style.cursor = 'crosshair';
  $('status').textContent = 'Assembly · Klicka på huvuddelen · Escape avbryter';
  renderer.domElement.focus({ preventScroll: true });
};
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
  move: (e) => {
    if (gridEditor?.active) return;
    pendingPointer = { clientX: e.clientX, clientY: e.clientY, buttons: e.buttons };
    if (tools.drawing || tools.operation) frameGate.invalidate();
  },
  leave: () => {
    if (gridEditor?.active) return;
    pendingPointer = null;
    objectFeedback.setHover([], 'canvas');
    if (
      ['rotate', 'plateCreate', 'plateVertex', 'fit'].includes(tools.operation?.mode) ||
      ui.componentPreview ||
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
    'component-property-target': (e) => {
      ray(e);
      componentUI.pickCopy(project.objects.find((s) => s.id === selectionHit()));
    },
    'fit-reference': (e) => {
      objectFeedback.setHover([], 'canvas');
      ray(e);
      const hit = raycaster.intersectObjects(
        objects.children.filter(
          (o) =>
            o.visible && (renderedById.get(o.userData.id)?.source?.type ?? 'sweep') === 'sweep',
        ),
        false,
      )[0];
      const source = hit && project.objects.find((s) => s.id === hit.object.userData.id);
      componentUI.pick(source, hit?.point.toArray());
    },
    'assembly-main': (e) => {
      ray(e);
      const mainId = selectionHit();
      try {
        if (!mainId) throw Error('Klicka på en fysisk huvuddel · Escape avbryter');
        const next = addToAssembly(project, tools.operation.secondaryIds, mainId);
        const assembly = next.assemblies.find((a) => a.mainId === mainId);
        checkpoint();
        Object.assign(project, next);
        setDrawing(false);
        setSelection(assembly.memberIds);
        render();
        $('status').textContent =
          `${assembly.mark} · ${assembly.memberIds.length} delar · Ångra återställer ändringen`;
      } catch (error) {
        $('status').textContent = `${error.message} · Välj huvuddel eller Escape för att avbryta`;
      }
    },
    'plate-property-target': (e) => {
      ray(e);
      platePropertyUI.pick(project.objects.find((s) => s.id === selectionHit()));
    },
    'sweep-property-target': (e) => {
      ray(e);
      sweepPropertyUI.pick(project.objects.find((s) => s.id === selectionHit()));
    },
    'fastener-target': (e) => {
      ray(e);
      const id = selectionHit();
      const source = project.objects.find((s) => s.id === id);
      if (!source || !isPhysical(source) || source.type === 'fastener') return;
      const ids = new Set(tools.operation.targetIds);
      if (ids.has(id)) ids.delete(id);
      else ids.add(id);
      tools.operation.targetIds = [...ids];
      fastenerUI.setTargets(tools.operation.targetIds);
      render({ selectionOnly: true });
      $('status').textContent =
        `${fastenerUI.groupEditor.enabled() ? 'Skruvgrupp' : 'Skruv'} · ${ids.size} delar valda · Klicka fler, Enter bekräftar`;
      renderer.domElement.focus({ preventScroll: true });
    },
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
      selectModelOrReference(selectionHit(), e.shiftKey);
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
    editing:
      ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName) ||
      document.activeElement.isContentEditable,
    settingsOpen: $('settings-dialog').open,
    modalOpen: !!document.querySelector('dialog[open]'),
    hasSelection: !!ui.selectedIds.size || !!referenceModels?.transformSelection(),
    hasEditableSweeps:
      !gridEditor?.active &&
      inspectorSelection().length > 0 &&
      inspectorSelection().every(editableSweep),
    mode: tools.operation?.mode,
    picking: tools.operation?.picking,
    hasStart: !!tools.first,
    drawing: tools.drawing,
    plateLength: plateLengthActive(),
  });
  if (!command) return;
  e.preventDefault();
  switch (command) {
    case 'sweep-placement':
    case 'sweep-profile-rotation':
      if (
        inspector.stage((s) =>
          command === 'sweep-placement' ? stepSweepPlacement(s, e.key) : quarterTurnSweep(s),
        )
      ) {
        inspector.finish();
        if (!inspector.multiEditing && inspectorSelection().length === 1)
          fillForm(inspectorSelection()[0]);
      }
      break;
    case 'confirm-component-properties':
      componentUI.confirmCopy();
      break;
    case 'move':
    case 'copy':
    case 'rotate':
      $(command).click();
      break;
    case 'confirm-plate-properties':
      platePropertyUI.confirm();
      break;
    case 'confirm-sweep-properties':
      sweepPropertyUI.confirm();
      break;
    case 'confirm-fit':
      componentUI.confirm();
      break;
    case 'confirm-fastener-targets':
      fastenerUI.confirmTargets();
      break;
    case 'cancel':
      cancelBox();
      if (tools.operation?.mode === 'assemblyMain') $('status').textContent = 'Assembly avbruten';
      if (tools.operation?.mode === 'fit') $('status').textContent = 'Fit avbruten';
      if (
        ['sweepProperties', 'plateProperties', 'componentProperties'].includes(
          tools.operation?.mode,
        )
      )
        $('status').textContent = 'Egenskapskopiering avbruten';
      assemblyMenu.hidden = true;
      select(null);
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
function loadFrameExample(size) {
  const started = performance.now();
  const example = createFrameExample(size, { prepareGeometry: true });
  inspector?.finish();
  checkpoint();
  setDrawing(false);
  Object.assign(project, example);
  project.references = example.references || { folders: ['Standard'], models: [] };
  referenceModels?.restore(project.references);
  projectHistory.prime(project);
  hiddenObjects.clear();
  modelFilter?.reset();
  ui.sequence = project.objects.length;
  levelsUI?.sync();
  grid.set({ ...project.grid, z: levelElevation(project.levels) });
  select(null);
  inspector.show('model');
  fit(new THREE.Vector3(1, -1, 1).normalize(), new THREE.Box3().setFromObject(objects));
  const screws = project.objects.filter(isFastener);
  const holes = screws.reduce((n, s) => n + s.holes.length, 0);
  return `Exempel inläst · ${project.objects.length} objekt · ${screws.length} skruvar · ${holes} hål · uppbyggnad ${((performance.now() - started) / 1000).toFixed(1)} s`;
}
const settingsController = createSettingsController({
  project,
  checkpoint,
  onOrbitDampingChanged: (enabled) => {
    navigation.controls.enableDamping = enabled;
  },
  loadExample: loadFrameExample,
  libraries: [
    {
      group: 'Modell',
      name: 'Material',
      description: 'Materialtyper, densitet och standardfärg',
      open: () => materialUI.openLibrary(),
    },
    {
      group: 'Modell',
      name: 'Profiler',
      description: 'Tvärsnitt och profildimensioner',
      open: () => sectionEditor.open(),
    },
    {
      group: 'Modell',
      name: 'Skruvar',
      description: 'Träskruv och skruv med mutter',
      open: () => fastenerUI.openLibrary(),
    },
    {
      group: 'Modell',
      name: 'Färger',
      description: 'Färger för material och objekt',
      open: () => materialUI.colors.open(),
    },
    {
      group: 'Ritningar',
      name: 'Attribut',
      open: () =>
        openDrawingAttributeLibrary(() => {
          if (drawingController.manager.dialog.open) drawingController.manager.render();
          if (drawingController.singleSheet.dialog.open) drawingController.singleSheet.compose();
          if (drawingController.planView.dialog.open) drawingController.planView.refreshPaper();
        }),
    },
    {
      group: 'Ritningar',
      name: 'Ritningsinställningar',
      description: 'Sparade uppsättningar för textstil, layout och visning',
      open: () => drawingSettings.open(),
    },
    {
      group: 'Ritningar',
      name: 'Ramblock',
      description: 'Ritningsramar och stämpelfält',
      open: () => {
        frameEditor.open();
        frameEditor.switchMode('block');
      },
    },
    {
      group: 'Ritningar',
      name: 'Layouter',
      description: 'Placering av ramblock på ritningsblad',
      open: () => {
        frameEditor.open();
        frameEditor.switchMode('layout');
      },
    },
    {
      group: 'Ritningar',
      name: 'Pappersformat',
      description: 'Bladstorlekar för ritningar',
      open: () => drawingController.singleSheet.openLibrary(),
    },
  ],
  onClose: () => {
    if (tools.drawing) renderer.domElement.focus({ preventScroll: true });
  },
  editGrid: () => gridEditor.start(),
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
installProjectFiles({
  project,
  newProject: () => createProject({ grid: defaultGrid, levels: initialLevels() }),
  finishEditing: () => inspector?.finish(),
  onLoaded: fillSettings,
  loadProject: (next) => {
    const previous = captureProject(project);
    const apply = (state) => {
      setDrawing(false);
      Object.assign(project, state);
      referenceModels?.restore(project.references);
      projectHistory.prime(project);
      hiddenObjects.clear();
      modelFilter?.reset();
      ui.exactProfileIds.clear();
      ui.sequence = project.objects.length;
      levelsUI?.sync();
      grid.set({ ...project.grid, z: levelElevation(project.levels) });
      select(null);
      inspector.show('model');
      fillSettings();
      fit(new THREE.Vector3(1, -1, 1).normalize(), new THREE.Box3().setFromObject(objects));
    };
    try {
      apply(next);
    } catch (error) {
      apply(previous);
      throw error;
    }
    projectHistory.checkpoint(previous);
    $('undo').disabled = false;
    $('redo').disabled = true;
  },
});
function cancelInspectorPreview() {
  if (ui.inspectorPreview) {
    scene.remove(ui.inspectorPreview);
    dispose(ui.inspectorPreview);
    ui.inspectorPreview = null;
  }
  if (!tools.operation)
    objects.children.forEach((child) => (child.visible = isVisible(child.userData.id)));
}
function inspectorSelection() {
  return inspector
    ? inspector.getState().selected
    : project.objects.filter((s) => ui.selectedIds.has(s.id));
}
inspector = new Inspector({
  scopeChanged: (staged = false) => {
    if (!staged) render();
    else syncMaterialPanel();
  },
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
    const next = applyObjectBatch(project.objects, batch).objects;
    checkpoint();
    project.objects = next;
    for (const object of batch) {
      rememberSweep(object);
      rememberPlate(object);
    }
    render();
    $('status').textContent = 'Egenskaper uppdaterade';
  },
  fillStandard: (object) => fillForm(object),
  fill: (batch) => {
    if (batch.length === 1 && !inspector.multiEditing) {
      fillForm(batch[0]);
      $('inspector-name').value = batch[0].name;
    } else inspector.fillCommon(batch);
  },
  remove,
});
function validateSweep(s) {
  const error = validateObject(s);
  if (error) return error;
  if (
    s.id &&
    project.objects.some((o) => o.id === s.id) &&
    ui.selectedIds.size <= 1 &&
    (tools.operation?.sources?.length || 0) <= 1
  ) {
    try {
      applyObjectBatch(project.objects, [s]);
    } catch (error) {
      return error.message;
    }
  }
  if (isFastener(s)) {
    try {
      validateFastenerTargets(s, project.objects);
      const model = [...project.objects.filter((old) => old.id !== s.id), s];
      for (const h of s.holes)
        displayGeometry(
          model.find((o) => o.id === h.targetId),
          model,
          'exact',
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
      displayGeometry(target, model, 'exact').dispose();
    return '';
  } catch (error) {
    return error.message;
  }
}
function previewModelBatch(batch, ghost = true) {
  const previous = new Map(project.objects.map((s) => [s.id, s]));
  const batchIds = new Set(batch.map((s) => s.id));
  const groupId = batch[0]?.group?.id;
  const groupPreview = groupId && batch.every((s) => s.group?.id === groupId);
  let model = groupPreview
    ? updateAutomaticJoints(project.objects, replaceFastenerGroup(project.objects, batch))
    : applyObjectBatch(
        project.objects,
        batch.filter((s) => s.id),
      ).objects;
  if (!groupPreview && batch.some((s) => !previous.has(s.id)))
    model = updateAutomaticJoints(project.objects, [
      ...model,
      ...batch.filter((s) => !previous.has(s.id)),
    ]);

  const affected = new Set(batch.map((s) => s.id));
  const proposed = new Map(model.map((s) => [s.id, s]));
  for (const s of [...project.objects, ...model])
    if (
      s.generatedBy &&
      (previous.get(s.id) !== proposed.get(s.id) || batchIds.has(s.generatedBy))
    ) {
      affected.add(s.id);
      for (const h of s.holes || []) affected.add(h.targetId);
    }
  if (groupPreview)
    for (const s of project.objects)
      if (s.group?.id === groupId) {
        affected.add(s.id);
        for (const h of s.holes) affected.add(h.targetId);
      }
  for (const s of model) {
    const old = previous.get(s.id);
    if (s.type === 'component' && s !== old) {
      affected.add(s.id);
      for (const id of [...s.targets, ...(old?.targets || [])]) affected.add(id);
    }
    if (isFastener(s) && (s !== old || batchIds.has(s.id))) {
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
  // Move/copy targets are previews; keep the real model at its original position
  // so its visible geometry agrees with the unchanged snapping index.
  const keepOriginals = ghost && ['move', 'copy'].includes(tools.operation?.mode);
  objects.children.forEach(
    (child) =>
      (child.visible =
        isVisible(child.userData.id) && (keepOriginals || !affected.has(child.userData.id))),
  );
  objectFeedback.setModel(keepOriginals ? project.objects : model);
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
  if (inspector?.multiEditing) {
    const sources = inspectorSelection();
    if (!sources.length || !sources.every((s) => (s.type || 'sweep') === 'sweep')) return;
    inspector.stage((s) => ({
      ...s,
      profile: 'custom',
      section: structuredClone(section),
      width: section.properties.bounds.width,
      height: section.properties.bounds.height,
      material: suggestedProfileMaterial(section, s.material, materialUI.records, !s.material),
    }));
    return;
  }
  inspector?.finish();
  ui.libraryMode = true;
  const sources = inspectorSelection().filter((s) => (s.type || 'sweep') === 'sweep');
  const apply = (s) => ({
    ...s,
    profile: 'custom',
    section: structuredClone(section),
    width: section.properties.bounds.width,
    height: section.properties.bounds.height,
    material: suggestedProfileMaterial(section, s.material, materialUI.records, !s.material),
  });
  if (sources.length) {
    const batch = sources.map(apply),
      error = batch.map(validateSweep).find(Boolean);
    if (error) throw new Error(error);
    const next = applyObjectBatch(project.objects, batch).objects;
    checkpoint();
    project.objects = next;
    for (const object of batch) {
      rememberSweep(object);
      rememberPlate(object);
    }
    setDrawing(false);
    if (ui.selected) fillForm(project.objects.find((s) => s.id === ui.selected));
    render();
  } else {
    startDrawing();
    ui.formSection = structuredClone(section);
    ui.draftMaterial.material = suggestedProfileMaterial(
      section,
      ui.draftMaterial.material,
      materialUI.records,
      ui.draftMaterialAutomatic,
    );
    $('profile').value = 'custom';
    updateForm();
    syncMaterialPanel();
    rememberSweep({ ...readForm(), ...ui.draftMaterial });
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
  if (!inspector?.multiEditing) inspector?.finish();
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
    if (inspector?.multiEditing) {
      inspector.stage((s) => (isPhysical(s) ? { ...s, ...structuredClone(patch) } : s));
      return;
    }
    inspector?.finish();
    const targets = inspectorSelection().filter(isPhysical);
    if (targets.length) {
      checkpoint();
      const ids = new Set(targets.map((s) => s.id));
      project.objects = project.objects.map((s) =>
        ids.has(s.id) ? { ...s, ...structuredClone(patch) } : s,
      );
      targets.forEach((source) => {
        rememberSweep({ ...source, ...patch });
        rememberPlate({ ...source, ...patch });
      });
      render();
    } else {
      ui.draftMaterial = { ...ui.draftMaterial, ...structuredClone(patch) };
      if ('material' in patch) ui.draftMaterialAutomatic = false;
      syncMaterialPanel();
      if (tools.drawing && !tools.operation) rememberSweep({ ...readForm(), ...ui.draftMaterial });
      if (
        tools.operation?.mode === 'plateCreate' &&
        !tools.operation.cutTargets &&
        !tools.operation.lineCut
      )
        rememberPlate({
          type: 'plate',
          thickness: +$('plate-thickness').value,
          side: $('plate-side').value,
          contourOffset: +$('plate-contour-offset').value,
          ...ui.draftMaterial,
        });
    }
  },
});
function syncMaterialPanel() {
  const selectedObjects = (inspector?.editingObjects() || inspectorSelection()).filter(isPhysical);
  const creating =
    tools.drawing &&
    !ui.selectedIds.size &&
    (!tools.operation ||
      (tools.operation.mode === 'plateCreate' && !tools.operation.cutTargets?.length));
  const section = selectedObjects.length
    ? selectedObjects.every(
        (s) =>
          s.profile === 'custom' && s.section?.standard === selectedObjects[0].section?.standard,
      )
      ? selectedObjects[0].section
      : null
    : creating && !tools.operation && $('profile').value === 'custom'
      ? ui.formSection
      : null;
  materialUI?.sync(
    selectedObjects.length ? selectedObjects : [ui.draftMaterial],
    !!selectedObjects.length || creating,
    !!tools.operation && tools.operation.mode !== 'plateCreate',
    profileMaterialSuggestions(section, materialUI?.records),
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
  modelFilter?.sync(project);
  ui.selectedIds = new Set([...ui.selectedIds].filter(isVisible));
  ui.selected = ui.selectedIds.size === 1 ? [...ui.selectedIds][0] : null;
  render();
}
modelTree = new ModelTree($('object-list'), {
  selectGroup: (ids, add) => {
    if (ids.some((id) => !modelFilter.allows(id))) {
      modelFilter.reset();
      modelFilter.sync(project);
    }
    ids.forEach((id) => hiddenObjects.delete(id));
    const selection = add ? new Set(ui.selectedIds) : new Set();
    const remove = add && ids.every((id) => selection.has(id));
    ids.forEach((id) => (remove ? selection.delete(id) : selection.add(id)));
    setSelection([...selection], true);
  },
  select: (id, add) => {
    if (!modelFilter.allows(id)) {
      modelFilter.reset();
      modelFilter.sync(project);
    }
    hiddenObjects.delete(id);
    if (isHelper(project.objects.find((s) => s.id === id))) ui.showHelpers = true;
    select(id, add, true);
  },
  visible: isVisible,
  toggle: (id) =>
    changeVisibility(() => {
      if (isVisible(id)) hiddenObjects.add(id);
      else {
        if (!modelFilter.allows(id)) modelFilter.reset();
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
      modelFilter?.reset();
      ui.showHelpers = true;
    }),
});
const filterBounds = new WeakMap();
modelFilter = new ModelFilter({
  inspector,
  baseVisible,
  change: () => {
    changeVisibility(() => modelFilter.sync(project));
    inspector.show('filter');
    $('status').textContent = modelFilter.active
      ? `Filter aktivt · ${modelFilter.matches.size} ${modelFilter.matches.size === 1 ? 'träff' : 'träffar'} av ${project.objects.length} objekt`
      : 'Alla modellfilter återställda';
  },
  showAll: () => {
    changeVisibility(() => {
      hiddenObjects.clear();
      ui.showHelpers = true;
    });
    inspector.show('filter');
    $('status').textContent = 'Alla objekt visas';
  },
  selectMatches: (ids) => {
    setSelection(ids, true);
    ui.selectedIds = new Set([...ui.selectedIds].filter(isVisible));
    ui.selected = ui.selectedIds.size === 1 ? [...ui.selectedIds][0] : null;
    render({ selectionOnly: true });
    inspector.show('filter');
  },
  getViewIds: () => {
    camera.updateMatrixWorld();
    objects.updateMatrixWorld(true);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    );
    return new Set(
      objects.children
        .filter((child) => {
          let box = filterBounds.get(child);
          if (!box) {
            box = new THREE.Box3().setFromObject(child);
            filterBounds.set(child, box);
          }
          return frustum.intersectsBox(box);
        })
        .map((child) => child.userData.id),
    );
  },
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
const numbering = installNumbering({
  getState: () => project,
  beforeOpen: () => {
    inspector?.finish();
    setDrawing(false);
  },
  commit: (patch) => {
    checkpoint();
    Object.assign(project, patch);
    render();
    $('status').textContent = 'Numrering tilldelad · Kan ångras';
  },
  highlight: (ids) => {
    ids.forEach((id) => hiddenObjects.delete(id));
    setSelection(ids, true);
  },
  zoom: (ids) => {
    const bounds = new THREE.Box3(),
      geometry = selectionGeometryReader(project.objects, { exactProfileIds: ui.exactProfileIds }),
      selected = new Set(ids);
    for (const object of project.objects)
      if (selected.has(object.id)) bounds.union(geometry.bounds(object));
    if (!bounds.isEmpty()) {
      fit(undefined, bounds);
      frameGate.invalidate();
    }
  },
  onClose: () => drawingManager.render(),
});
drawingManager.openNumbering = (kinds) => numbering.open(kinds);
const numberingButton = document.createElement('button');
numberingButton.id = 'numbering-open';
numberingButton.textContent = 'Numrering';
numberingButton.onclick = () => numbering.open();
document.querySelector('header .history').prepend(numberingButton);
for (const [id, key] of [
  ['move', 'M'],
  ['copy', 'C'],
  ['rotate', 'R'],
]) {
  $(id).title = `${$(id).getAttribute('aria-label')} (Ctrl+${key})`;
  $(id).setAttribute('aria-keyshortcuts', `Control+${key} Meta+${key}`);
}
function highlightFitReferences(ids) {
  objectFeedback.setReferences(ids);
}
function hoverInspectorReference(id) {
  objectFeedback.setHover(id ? [id] : [], 'inspector');
}
function updateObjectHover(e) {
  const fit = tools.operation?.mode === 'fit';
  const propertyCopy = ['sweepProperties', 'plateProperties', 'componentProperties'].includes(
    tools.operation?.mode,
  );
  if (
    e.buttons ||
    ui.marquee ||
    (tools.drawing && !fit) ||
    (tools.operation && !fit && !propertyCopy)
  ) {
    objectFeedback.setHover([], 'canvas');
    return;
  }
  ray(e);
  const previewHit =
    ui.componentPreview && ui.preview
      ? raycaster.intersectObjects(
          [...objects.children, ...ui.preview.children].filter(
            (o) =>
              o.visible &&
              !o.userData.cut &&
              (camera.layers.test(o.layers) || o.userData.instanced),
          ),
          false,
        )[0]
      : null;
  const id = previewHit?.object.userData.id ?? selectionHit();
  const source = objectFeedback.sources.get(id) || renderedById.get(id)?.source;
  const eligible =
    isPhysical(source) &&
    (!fit || (source.type ?? 'sweep') === 'sweep') &&
    (!propertyCopy ||
      (tools.operation.mode === 'componentProperties'
        ? project.objects.find((s) => s.id === source?.generatedBy)?.kind === tools.operation.kind
        : tools.operation.mode === 'plateProperties'
          ? editablePlate(source)
          : editableSweep(source)));
  objectFeedback.setHover(
    eligible ? [id] : [],
    'canvas',
    fit ? objectFeedback.referenceCount : null,
  );
  if (!tools.operation && !tools.drawing)
    renderer.domElement.style.cursor = eligible ? 'pointer' : 'default';
}
componentUI = createComponentUI({
  beginCopy: (kind) => {
    inspector.finish();
    setDrawing(false);
    tools.operation = { mode: 'componentProperties', kind };
    renderer.domElement.style.cursor = 'crosshair';
    renderer.domElement.focus({ preventScroll: true });
    $('status').textContent =
      'Kopiera kopplingsegenskaper · Välj målkopplingar, sedan Modifiera eller Enter';
  },
  commitCopy: (batch) => {
    const previous = new Map(project.objects.map((s) => [s.id, s]));
    const next = applyObjectBatch(project.objects, batch).objects;
    for (const object of next)
      if (isPhysical(object) && object !== previous.get(object.id))
        displayGeometry(object, next, 'exact').dispose();
    checkpoint();
    project.objects = next;
    setDrawing(false);
    setSelection(batch.map((s) => s.id));
    render();
    $('status').textContent =
      `Egenskaper kopierade till ${batch.length} koppling${batch.length === 1 ? '' : 'ar'} · Ångra återställer ändringen`;
  },
  getObjects: () => project.objects,
  getSelection: () => project.objects.filter((s) => ui.selectedIds.has(s.id)),
  getFastenerSpecs: () => fastenerUI.records,
  openFastenerLibrary: (onClose) => {
    fastenerUI.library.addEventListener('close', onClose, { once: true });
    fastenerUI.openLibrary({ preserveOperation: true });
  },
  selectSource: (id) => setSelection(id ? [id] : []),
  begin: (picking, kind) => {
    setDrawing(true);
    tools.operation = { mode: 'fit', picking, kind };
    renderer.domElement.style.cursor = picking ? 'crosshair' : 'default';
    syncOperationUI();
    renderer.domElement.focus({ preventScroll: true });
    render({ selectionOnly: true });
    $('status').textContent =
      kind === 'beamSplice'
        ? picking
          ? 'Balkskarv · Välj första och sedan andra balkänden · Escape avbryter'
          : 'Balkskarv · Kontrollera förhandsvisningen och klicka på Skapa'
        : kind === 'boltedEndplate'
          ? picking
            ? 'Ändplåtskoppling · Välj pelare, sedan balkände · Escape avbryter'
            : 'Ändplåtskoppling · Kontrollera förhandsvisningen och klicka på Skapa'
          : kind === 'endplate'
            ? picking
              ? 'Ändplåt · Klicka nära objektets ände · Escape avbryter'
              : 'Ändplåt · Kontrollera valen och klicka på Skapa ändplåt'
            : kind === 'stiffener'
              ? picking
                ? 'Avstyvning · Välj profil, sedan plats längs profilen · Escape avbryter'
                : 'Avstyvning · Kontrollera valen och klicka på Skapa avstyvning'
              : kind === 'baseplate'
                ? picking
                  ? 'Fotplåt · Klicka på pelaren · Escape avbryter'
                  : 'Fotplåt · Kontrollera valen och klicka på Skapa fotplåt'
                : 'Fit · Klicka första sweepen, sedan andra · Escape avbryter';
  },
  showInspector: () => inspector.show('properties'),
  highlight: highlightFitReferences,
  hoverReference: hoverInspectorReference,
  finish: () => {
    const fitActive = tools.operation?.mode === 'fit';
    const copyActive = tools.operation?.mode === 'componentProperties';
    inspector?.finish();
    setDrawing(false);
    if (fitActive) $('status').textContent = 'Fit avbruten';
    if (copyActive) $('status').textContent = 'Egenskapskopiering avbruten';
  },
  commit: (draft, mode) => {
    clearPreview();
    if (mode === 'clear') return;
    if (mode === 'preview') {
      ui.preview = previewModelBatch([draft], false);
      ui.componentPreview = true;
      scene.add(ui.preview);
      return;
    }
    const next =
      draft.id && project.objects.some((s) => s.id === draft.id)
        ? applyObjectBatch(project.objects, [draft]).objects
        : updateAutomaticJoints(project.objects, [...project.objects, draft]);
    for (const id of new Set([
      ...draft.targets,
      ...next.filter((s) => s.generatedBy === draft.id && s.type === 'plate').map((s) => s.id),
      ...next
        .filter((s) => s.generatedBy === draft.id)
        .flatMap((s) => (s.holes || []).map((h) => h.targetId)),
    ]))
      displayGeometry(
        next.find((s) => s.id === id),
        next,
        'exact',
      ).dispose();
    checkpoint();
    project.objects = next;
    setSelection([draft.id]);
    $('status').textContent =
      `${draft.kind === 'beamSplice' ? 'Balkskarv' : draft.kind === 'boltedEndplate' ? 'Ändplåtskoppling' : draft.kind === 'endplate' ? 'Ändplåt' : draft.kind === 'stiffener' ? 'Avstyvning' : draft.kind === 'baseplate' ? 'Fotplåt' : 'Fit'} sparad · klicka på kopplingssymbolen för att modifiera`;
  },
});
function createPropertyCopyUI(family) {
  const plate = family === 'plate';
  const editable = plate ? editablePlate : editableSweep;
  const copyProperties = plate ? copyPlateProperties : copySweepProperties;
  const remember = plate ? rememberPlate : rememberSweep;
  const mode = plate ? 'plateProperties' : 'sweepProperties';
  const noun = plate ? 'plåt' : 'sweep';
  return createObjectPropertyUI({
    schema: objectInspectorSchemas[family],
    getState: () => ({
      selected: inspectorSelection(),
      multiEditing: inspector.multiEditing,
      operation: tools.operation,
      drawing: tools.drawing,
    }),
    start: (groups) => {
      inspector.finish();
      const source = project.objects.find((s) => s.id === ui.selected);
      if (!editable(source)) throw new Error(`Markera en ${noun} att kopiera från.`);
      setDrawing(false);
      tools.operation = {
        mode,
        source: structuredClone(source),
        groups,
        targetIds: [],
      };
      render({ selectionOnly: true });
      renderer.domElement.style.cursor = 'crosshair';
      renderer.domElement.focus({ preventScroll: true });
      $('status').textContent =
        'Kopiera egenskaper · Klicka på målobjekt, sedan Modifiera eller Enter';
    },
    toggle: (id) => {
      const operation = tools.operation;
      if (id === operation.source.id) throw new Error('Välj ett annat mål än källobjektet.');
      const ids = new Set(operation.targetIds);
      if (ids.has(id)) ids.delete(id);
      else ids.add(id);
      operation.targetIds = [...ids];
      frameGate.invalidate();
    },
    apply: (groups) => {
      const operation = tools.operation;
      if (operation?.mode !== mode || !operation.targetIds.length) return;
      if (!groups.length) throw new Error('Välj minst en egenskap.');
      const previous = new Map(project.objects.map((s) => [s.id, s]));
      const batch = operation.targetIds.map((id) =>
        copyProperties(operation.source, previous.get(id), groups),
      );
      const error = batch.map(validateObject).find(Boolean);
      if (error) throw new Error(error);
      const next = applyObjectBatch(project.objects, batch).objects;
      for (const object of next)
        if (isPhysical(object) && object !== previous.get(object.id))
          displayGeometry(object, next, 'exact').dispose();
      checkpoint();
      project.objects = next;
      const count = batch.length;
      remember(operation.source);
      setDrawing(false);
      setSelection(batch.map((s) => s.id));
      render();
      $('status').textContent =
        `Egenskaper kopierade till ${count} ${noun}${count === 1 ? '' : plate ? 'ar' : 's'} · Ångra återställer ändringen`;
    },
    cancel: () => {
      setDrawing(false);
      render({ selectionOnly: true });
    },
    highlight: highlightFitReferences,
  });
}
sweepPropertyUI = createPropertyCopyUI('sweep');
platePropertyUI = createPropertyCopyUI('plate');
restoreSweepDefaults();
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

const drawingSettings = installDrawingSettings(drawingController, frameEditor);
installReports({
  project,
  frameEditor,
  checkpoint: () => {
    projectHistory.checkpoint(project);
    $('undo').disabled = false;
    $('redo').disabled = true;
  },
  finishEditing: () => {
    inspector?.finish();
    setDrawing(false);
  },
});
setupPWA();

referenceModels = new ReferenceModels({
  scene,
  inspector,
  onChange: (references) => {
    project.references = references;
    frameGate.invalidate();
    $('undo').disabled = !projectHistory.canUndo;
    $('redo').disabled = !projectHistory.canRedo;
  },
  beforePlacementChange: checkpoint,
  onSelect: (model) => {
    if (model?.locked && tools.operation?.referenceId === model.id) setDrawing(false);
    if (model && !tools.operation) {
      ui.selectedIds.clear();
      ui.selected = null;
      render({ selectionOnly: true });
      inspector.show('references');
    }
    syncOperationUI();
  },
  fit: (bounds) => fit(undefined, bounds),
  status: (text) => {
    document.querySelector('footer [role=status]').textContent = text;
  },
  getObjects: () => project.objects,
  convert: (added) => {
    inspector.finish();
    setDrawing(false);
    checkpoint();
    project.objects.push(...added);
    setSelection(added.map((object) => object.id));
    $('status').textContent = `${added.length} IFC-objekt konverterade · Kan ångras`;
  },
});

gridEditor = createGridModelEditor({
  host,
  camera,
  grid,
  project,
  getControls: () => navigation.controls,
  elevation: () => levelElevation(project.levels),
  begin: () => {
    inspector.finish();
    cancelBox();
    pendingPointer = null;
    select(null);
    inspector.show('model');
    referenceModels.clearObjectSelection();
  },
  checkpoint,
  changed: () => {
    fillSettings();
    render();
  },
  invalidate: () => frameGate.invalidate(),
  status: (text) => {
    $('status').textContent = text;
  },
  undo: restore,
});

if (import.meta.env.DEV && new URLSearchParams(location.search).get('memory') === '1') {
  const { installMemoryBenchmark } = await import('./model/memory-benchmark.js');
  installMemoryBenchmark({
    project,
    history: projectHistory,
    renderer,
    loadExample: loadFrameExample,
    commit: commitFastener,
    restore,
    scene,
  });
}

if (import.meta.env.DEV && new URLSearchParams(location.search).get('referenceMemory') === '1') {
  const { installReferenceMemoryBenchmark } = await import('./references/memory-benchmark.js');
  installReferenceMemoryBenchmark({
    references: referenceModels,
    renderer,
    camera,
    host,
    project,
    history: projectHistory,
  });
}
