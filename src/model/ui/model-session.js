import { loadPlateDefaults, editablePlate, storePlateDefaults } from '../plate-properties.js';
import { loadSweepDefaults, editableSweep, storeSweepDefaults } from '../sweep-properties.js';
import { groupSelection } from '../../fasteners/group-data.js';
import { modelSelection, canSelectModelObject } from '../selection-mode.js';
import { isHelper, isCut, isPlate, isPhysical } from '../../model-object.js';
import { nextIdentity, typeName } from '../../object-identity.js';
import { componentDeletion } from '../../components/ownership.js';
import { removeFastenerRelations } from '../../fasteners/relations.js';
import { updateAutomaticJoints } from '../../fasteners/update-joints.js';
import { levelElevation } from '../../levels.js';
import { resetToolInteraction } from '../tool-session.js';
import * as THREE from 'three';

export function installModelSession({
  $,
  actions,
  camera,
  connectionMarkers,
  controllers,
  frameGate,
  grid,
  guide,
  host,
  insertionPoints,
  interactionTimings,
  modelEditor,
  navigation,
  objectFeedback,
  objects,
  project,
  projectHistory,
  raycaster,
  renderer,
  tools,
  ui,
}) {
  const cancelInspectorPreview = (...args) => actions.cancelInspectorPreview(...args);
  const clearPlateOutline = (...args) => actions.clearPlateOutline(...args);
  const clearPreview = (...args) => actions.clearPreview(...args);
  const fillForm = (...args) => actions.fillForm(...args);
  const fillSettings = (...args) => actions.fillSettings(...args);
  const fit = (...args) => actions.fit(...args);
  const isVisible = (...args) => actions.isVisible(...args);
  const readForm = (...args) => actions.readForm(...args);
  const render = (...args) => actions.render(...args);
  const resetLength = (...args) => actions.resetLength(...args);
  const startTransform = (...args) => actions.startTransform(...args);
  const syncLocks = (...args) => actions.syncLocks(...args);
  const syncMaterialPanel = (...args) => actions.syncMaterialPanel(...args);
  const syncPlateUI = (...args) => actions.syncPlateUI(...args);
  const syncWorkPlane = (...args) => actions.syncWorkPlane(...args);
  const updateSnapOverlay = (...args) => actions.updateSnapOverlay(...args);
  const validateSweep = (...args) => actions.validateSweep(...args);
  Object.assign(actions, {
    setSelection,
    isSelectable,
    setGridSelectionLocked,
    select,
    userSelection,
    selectModelOrReference,
    checkpoint,
    save,
    remove,
    restore,
    setDrawing,
    rememberPlate,
    restorePlateDefaults,
    rememberSweep,
    restoreSweepDefaults,
    startDrawing,
    syncOperationUI,
  });
  let lastPlateDefaults = loadPlateDefaults(localStorage);
  let lastSweepDefaults = loadSweepDefaults(localStorage);
  let selectableObjects = null,
    selectionObjectsById = new Map();
  function isSelectable(id) {
    if (selectableObjects !== project.objects) {
      selectableObjects = project.objects;
      selectionObjectsById = new Map(project.objects.map((object) => [object.id, object]));
    }
    return canSelectModelObject(selectionObjectsById.get(id), ui);
  }
  function selectableIds(ids) {
    return [...ids].filter(isSelectable);
  }
  function setGridSelectionLocked(locked) {
    controllers.inspector?.finish();
    actions.cancelBox?.();
    ui.gridSelectionLocked = !!locked;
    setSelection(ui.selectedIds, true);
  }
  function setSelection(ids, keepTab = false) {
    controllers.referenceModels?.clearObjectSelection();
    controllers.inspector?.rollback();
    setDrawing(false);
    ui.selectedIds = new Set(selectableIds(groupSelection(project.objects, selectableIds(ids))));
    ui.selected = ui.selectedIds.size === 1 ? [...ui.selectedIds][0] : null;
    if (ui.selected) fillForm(project.objects.find((s) => s.id === ui.selected));
    render({ selectionOnly: true });
    if (ui.selectedIds.size && !keepTab) controllers.inspector.show('properties');
  }
  function select(id, additive = false, keepTab = false) {
    const ids = additive ? new Set(ui.selectedIds) : new Set();
    if (id) {
      if (additive && ids.has(id)) {
        for (const memberId of userSelection([id])) ids.delete(memberId);
      } else for (const memberId of userSelection([id])) ids.add(memberId);
    }
    setSelection(ids, keepTab);
  }
  function userSelection(ids) {
    return new Set(
      selectableIds(
        modelSelection(project.objects, project.assemblies, selectableIds(ids), ui.selectionMode),
      ),
    );
  }
  function selectModelOrReference(id, additive = false) {
    const reference = !id && controllers.referenceModels?.pickReference(raycaster);
    if (reference) {
      setSelection([], true);
      if (reference.ifcId != null) controllers.referenceModels.selectObject(reference);
      else controllers.referenceModels.showModel(reference.modelId);
      controllers.inspector.show('references');
      frameGate.invalidate();
    } else select(id, additive);
  }
  function checkpoint() {
    controllers.projectAutosave?.schedule();
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
        edited = modelEditor.prepare([s]).objects;
      } catch (error) {
        $('inspector-error').textContent = $('error').textContent = error.message;
        return false;
      }
    }
    if (ui.selected) {
      modelEditor.replace(edited);
    } else {
      const id = crypto.randomUUID();
      modelEditor.add([
        {
          ...(isHelper(s) ? {} : ui.draftMaterial),
          ...s,
          ...nextIdentity(s, project.objects),
          id,
          name:
            s.type === 'gridline'
              ? s.name
              : s.type === 'item'
                ? s.item.name
                : `${typeName(s)} ${String(++ui.sequence).padStart(2, '0')}`,
        },
      ]);
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
    modelEditor.replace(next);
    ui.selected = null;
    ui.selectedIds.clear();
    clearPreview();
    render();
    $('status').textContent = 'Markeringen borttagen';
  }
  $('delete').onclick = $('multi-delete').onclick = remove;
  function restore(direction) {
    const next = interactionTimings.measure('historyRestoreMs', () =>
      projectHistory[direction](project),
    );
    if (!next) return;
    Object.assign(project, next);
    controllers.referenceModels?.restore(project.references);
    controllers.levelsUI?.sync();
    fillSettings();
    grid.set({ ...project.grid, modelObjects: true, z: levelElevation(project.levels) });
    select(null);
    $('status').textContent = 'Modellen återställd';
  }
  $('undo').onclick = () => restore('undo');
  $('redo').onclick = () => restore('redo');
  function setDrawing(value) {
    objectFeedback.clearHover();
    controllers.componentUI?.cancel();
    controllers.inspector?.rollback();
    cancelInspectorPreview();
    clearPlateOutline();
    controllers.rotationLine.visible = false;
    controllers.rotationHandle.hide();
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
    controllers.helperController.sync();
    controllers.componentUI?.sync();
    controllers.sweepPropertyUI?.sync();
    controllers.platePropertyUI?.sync();
    objectFeedback.setSelection(ui.selectedIds);
    objectFeedback.setModel(project.objects);
    connectionMarkers.sync(
      project.objects,
      ui.selectedIds,
      isVisible,
      tools.operation?.mode === 'fit',
    );
    controllers.fastenerUI?.sync(
      project.objects.filter((s) => ui.selectedIds.has(s.id)),
      tools.operation,
    );
    controllers.itemUI?.sync();
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
    controllers.inspector?.finish();
    if (ui.selected) rememberSweep(project.objects.find((o) => o.id === ui.selected));
    select(null);
    restoreSweepDefaults();
    setDrawing(true);
    controllers.inspector.show('properties');
  }
  function syncOperationUI() {
    for (const id of ['move', 'copy', 'rotate']) {
      $(id).disabled =
        !ui.selectedIds.size &&
        !(id !== 'copy' && controllers.referenceModels?.transformSelection());
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
      tools.operation &&
      !tools.operation.mode.startsWith('helper') &&
      !['gridline', 'itemCreate', 'fastenerCreate', 'plateCreate'].includes(tools.operation.mode)
        ? tools.operation.mode === 'copy'
          ? 'Kopiera ↵'
          : 'Flytta ↵'
        : 'Skapa ↵';
  }
  $('move').onclick = () => startTransform('move');
  $('copy').onclick = () => startTransform('copy');
  $('draw').onclick = startDrawing;
  $('select').onclick = () => setDrawing(false);
}
