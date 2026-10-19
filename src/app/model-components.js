import { componentPlacementPrompt } from '../components/placement-session.js';
import { componentDefinition } from '../components/definitions.js';
import { createComponentUI } from '../components/ui.js';
import { applyObjectBatch } from '../model/tools/transform-tool.js';
import { displayGeometry } from '../model-object.js';
import { updateAutomaticJoints } from '../fasteners/update-joints.js';

export function installModelComponents({
  $,
  actions,
  controllers,
  modelEditor,
  project,
  renderer,
  scene,
  tools,
  ui,
}) {
  const clearPreview = (...args) => actions.clearPreview(...args);
  const highlightFitReferences = (...args) => actions.highlightFitReferences(...args);
  const hoverInspectorReference = (...args) => actions.hoverInspectorReference(...args);
  const previewModelBatch = (...args) => actions.previewModelBatch(...args);
  const render = (...args) => actions.render(...args);
  const setDrawing = (...args) => actions.setDrawing(...args);
  const setSelection = (...args) => actions.setSelection(...args);
  const syncOperationUI = (...args) => actions.syncOperationUI(...args);
  controllers.componentUI = createComponentUI({
    creationProperties: (object) => controllers.propertyUI?.defaultsFor(object) || object,
    promptChanged: (text) => {
      $('status').textContent = text;
    },
    getObjects: () => project.objects,
    getSelection: () => project.objects.filter((s) => ui.selectedIds.has(s.id)),
    getFastenerSpecs: () => controllers.fastenerUI.records,
    openFastenerLibrary: (onClose) => {
      controllers.fastenerUI.library.addEventListener('close', onClose, { once: true });
      controllers.fastenerUI.openLibrary({ preserveOperation: true });
    },
    selectSource: (id) => setSelection(id ? [id] : []),
    begin: (picking, kind) => {
      setDrawing(true);
      tools.operation = { mode: 'fit', picking, kind };
      renderer.domElement.style.cursor = picking ? 'crosshair' : 'default';
      syncOperationUI();
      renderer.domElement.focus({ preventScroll: true });
      render({ selectionOnly: true });
      $('status').textContent = componentPlacementPrompt(kind, 0, !picking);
    },
    showInspector: () => controllers.inspector.show('properties'),
    highlight: highlightFitReferences,
    hoverReference: hoverInspectorReference,
    finish: () => {
      const fitKind = tools.operation?.mode === 'fit' ? tools.operation.kind : null;
      controllers.inspector?.finish();
      setDrawing(false);
      if (fitKind) $('status').textContent = `${componentDefinition(fitKind).label} avbruten`;
    },
    commit: (draft, mode) => {
      clearPreview();
      if (mode === 'clear') return;
      if (draft && !project.objects.some((s) => s.id === draft.id))
        draft = actions.applyCreationAttributes?.(draft) || draft;
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
      modelEditor.replace(next);
      setSelection([draft.id]);
      $('status').textContent =
        `${componentDefinition(draft.kind).label} sparad · klicka på kopplingssymbolen för att modifiera`;
    },
  });
}
