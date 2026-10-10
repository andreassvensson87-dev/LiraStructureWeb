import { ReferenceModels } from '../references/reference-models.js';

export function installWorkspaceReferences({
  $,
  actions,
  controllers,
  frameGate,
  modelEditor,
  project,
  projectHistory,
  scene,
  tools,
  ui,
}) {
  const checkpoint = (...args) => actions.checkpoint(...args);
  const fit = (...args) => actions.fit(...args);
  const render = (...args) => actions.render(...args);
  const setDrawing = (...args) => actions.setDrawing(...args);
  const setSelection = (...args) => actions.setSelection(...args);
  const syncOperationUI = (...args) => actions.syncOperationUI(...args);
  controllers.referenceModels = new ReferenceModels({
    scene,
    inspector: controllers.inspector,
    onChange: (references) => {
      project.references = references;
      controllers.projectAutosave?.schedule();
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
        controllers.inspector.show('references');
      }
      syncOperationUI();
    },
    fit: (bounds) => fit(undefined, bounds),
    status: (text) => {
      document.querySelector('footer [role=status]').textContent = text;
    },
    getObjects: () => project.objects,
    convert: (added) => {
      controllers.inspector.finish();
      setDrawing(false);
      modelEditor.add(added);
      setSelection(added.map((object) => object.id));
      $('status').textContent = `${added.length} IFC-objekt konverterade · Kan ångras`;
    },
  });
}
