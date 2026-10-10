import { createComponentUI } from '../components/ui.js';
import { applyObjectBatch } from '../model/tools/transform-tool.js';
import { isPhysical, displayGeometry } from '../model-object.js';
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
    beginCopy: (kind) => {
      controllers.inspector.finish();
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
      modelEditor.replace(next);
      setDrawing(false);
      setSelection(batch.map((s) => s.id));
      render();
      $('status').textContent =
        `Egenskaper kopierade till ${batch.length} koppling${batch.length === 1 ? '' : 'ar'} · Ångra återställer ändringen`;
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
    showInspector: () => controllers.inspector.show('properties'),
    highlight: highlightFitReferences,
    hoverReference: hoverInspectorReference,
    finish: () => {
      const fitActive = tools.operation?.mode === 'fit';
      const copyActive = tools.operation?.mode === 'componentProperties';
      controllers.inspector?.finish();
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
      modelEditor.replace(next);
      setSelection([draft.id]);
      $('status').textContent =
        `${draft.kind === 'beamSplice' ? 'Balkskarv' : draft.kind === 'boltedEndplate' ? 'Ändplåtskoppling' : draft.kind === 'endplate' ? 'Ändplåt' : draft.kind === 'stiffener' ? 'Avstyvning' : draft.kind === 'baseplate' ? 'Fotplåt' : 'Fit'} sparad · klicka på kopplingssymbolen för att modifiera`;
    },
  });
}
