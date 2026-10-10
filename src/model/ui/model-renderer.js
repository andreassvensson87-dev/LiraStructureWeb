import { syncGridObjects } from '../grid-objects.js';
import { levelElevation } from '../../levels.js';
import { updateObjectMeshSelection } from '../object-mesh.js';
import { displayGeometryIdentityReader, createDisplayGeometryContext } from '../../model-object.js';
import { holesByTarget } from '../../fasteners/relations.js';
import { reconcileChildren } from '../reconcile-children.js';
import { SnapIndex } from '../snap-index.js';

export function installModelRenderer({
  $,
  actions,
  connectionMarkers,
  controllers,
  frameGate,
  grid,
  host,
  instanceBatches,
  interactionTimings,
  objectFeedback,
  objects,
  project,
  projectHistory,
  renderState,
  tools,
  ui,
}) {
  const dispose = (...args) => actions.dispose(...args);
  const isVisible = (...args) => actions.isVisible(...args);
  const mesh = (...args) => actions.mesh(...args);
  const renderCutRelations = (...args) => actions.renderCutRelations(...args);
  const syncIdentity = (...args) => actions.syncIdentity(...args);
  const syncMaterialPanel = (...args) => actions.syncMaterialPanel(...args);
  const syncOperationUI = (...args) => actions.syncOperationUI(...args);
  const syncPlateUI = (...args) => actions.syncPlateUI(...args);
  Object.assign(actions, { render });
  let renderedObjects = [];

  let renderedSelection = new Set();

  function render({ selectionOnly = false } = {}) {
    syncGridObjects(project);
    grid.set({ ...project.grid, modelObjects: true, z: levelElevation(project.levels) });
    if (!selectionOnly) controllers.projectAutosave?.schedule();
    const renderStarted = performance.now();
    controllers.modelFilter?.sync(project);
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
        const entry = renderState.renderedById.get(id);
        if (entry) updateObjectMeshSelection(entry.child, entry.source, selectedIds);
      }
    } else {
      instanceBatches.prepareRebuild();
      const previous = renderState.renderedById;
      const profileOptions = { exactProfileIds: ui.exactProfileIds };
      const geometry = displayGeometryIdentityReader(project.objects, profileOptions);
      const holes = holesByTarget(project.objects);
      const geometryContext = createDisplayGeometryContext(project.objects, profileOptions);
      const children = [];
      let reused = 0;
      renderState.renderedById = new Map();
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
        renderState.renderedById.set(s.id, { child, source: s });
        child.visible =
          isVisible(s.id) &&
          (tools.operation?.mode !== 'rotate' ||
            tools.operation.picking ||
            !ui.selectedIds.has(s.id));
        children.push(child);
      }
      for (const [id, entry] of previous)
        if (renderState.renderedById.get(id)?.child !== entry.child) dispose(entry.child);
      reconcileChildren(objects, children);
      renderedObjects = [...project.objects];
      instanceBatches.update(objects.children);
      interactionTimings.record('meshesAndBatchesMs', renderStarted);
      renderState.snapIndex = interactionTimings.measure(
        'snapIndexMs',
        () => new SnapIndex(project.objects),
      );
      if (import.meta.env?.DEV) {
        host.dataset.reusedMeshes = reused;
        host.dataset.createdMeshes = children.length - reused;
      }
    }
    renderedSelection = new Set(selectedIds);
    $('count').textContent = project.objects.length;
    interactionTimings.measure('modelTreeMs', () => {
      if (selectionOnly) controllers.modelTree?.setSelection(ui.selectedIds);
      else controllers.modelTree?.render(project.objects, ui.selectedIds, project.assemblies);
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
    controllers.helperController.sync();
    controllers.componentUI?.sync();
    controllers.sweepPropertyUI?.sync();
    controllers.platePropertyUI?.sync();
    controllers.itemUI?.sync();
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
    if (!selectionOnly) {
      controllers.planView?.sync();
      if (controllers.drawingManager?.dialog.open) controllers.drawingManager.render();
    }
    controllers.assemblyPanel?.sync();
    interactionTimings.record('otherUiMs', uiStarted);
  }
}
