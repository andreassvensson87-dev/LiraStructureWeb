import { installAssemblyPanel } from '../inspector/assembly-panel.js';
import { installModelChrome } from '../model/ui/model-chrome.js';

export function installWorkspaceAssemblies({
  actions,
  controllers,
  navigation,
  project,
  tools,
  ui,
}) {
  const cancelBox = (...args) => actions.cancelBox(...args);
  const checkpoint = (...args) => actions.checkpoint(...args);
  const render = (...args) => actions.render(...args);
  const setSelection = (...args) => actions.setSelection(...args);
  const userSelection = (...args) => actions.userSelection(...args);
  controllers.assemblyPanel = installAssemblyPanel({
    getState: () => ({
      ...project,
      selectedIds: ui.selectedIds,
      mode: ui.selectionMode,
      operation: tools.operation,
      drawing: tools.drawing,
    }),
    commit: (patch) => {
      controllers.inspector.finish();
      checkpoint();
      Object.assign(project, patch);
      render();
    },
    selectPart: (id) => setSelection([id], true),
  });
  controllers.assemblyPanel.sync();
  installModelChrome({
    getGridSelectionLocked: () => ui.gridSelectionLocked,
    setGridSelectionLocked: (locked) => actions.setGridSelectionLocked(locked),
    getSelectionMode: () => ui.selectionMode,
    setSelectionMode: (mode) => {
      controllers.inspector.finish();
      cancelBox();
      ui.selectionMode = mode;
      if (mode === 'assembly' && ui.selectedIds.size && !tools.operation && !tools.drawing)
        setSelection(userSelection(ui.selectedIds), true);
      else render({ selectionOnly: true });
    },
    front: () => navigation.lookAlongAxis('Y', -1),
    side: () => navigation.lookAlongAxis('X', 1),
  });
}
