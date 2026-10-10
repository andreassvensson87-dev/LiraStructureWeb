import { createItemController } from '../items/model-ui.js';
import { levelElevation } from '../levels.js';
import { applyObjectBatch } from '../model/tools/transform-tool.js';

export function installModelItems({
  controllers,
  project,
  ui,
  tools,
  renderer,
  modelEditor,
  $,
  actions,
}) {
  const select = (...args) => actions.select(...args);
  const setDrawing = (...args) => actions.setDrawing(...args);
  const syncOperationUI = (...args) => actions.syncOperationUI(...args);
  const save = (...args) => actions.save(...args);
  const remove = (...args) => actions.remove(...args);
  const render = (...args) => actions.render(...args);
  controllers.itemUI = createItemController({
    project,
    ui,
    tools,
    select,
    setDrawing,
    syncOperationUI,
    save,
    remove,
    renderer,
    showProperties: () => controllers.inspector.show('properties'),
    getElevation: () => levelElevation(project.levels),
    commit: (source) => {
      const next = applyObjectBatch(project.objects, [source]).objects;
      modelEditor.replace(next);
      render();
      $('status').textContent = 'Item uppdaterat';
    },
  });
}
