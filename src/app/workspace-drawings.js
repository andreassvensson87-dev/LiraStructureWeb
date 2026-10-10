import { createDrawingController } from './drawing-controller.js';
import { installNumbering } from '../numbering/ui.js';
import * as THREE from 'three';
import { selectionGeometryReader } from '../model-object.js';

export function installWorkspaceDrawings({
  $,
  actions,
  controllers,
  frameGate,
  hiddenObjects,
  project,
  ui,
}) {
  const checkpoint = (...args) => actions.checkpoint(...args);
  const fit = (...args) => actions.fit(...args);
  const render = (...args) => actions.render(...args);
  const setDrawing = (...args) => actions.setDrawing(...args);
  const setSelection = (...args) => actions.setSelection(...args);
  const syncIdentity = (...args) => actions.syncIdentity(...args);
  const drawingController = createDrawingController({
    project,
    checkpoint,
    getSelection: () => ui.selectedIds,
    finishEditing: () => controllers.inspector?.finish(),
    stopTool: () => setDrawing(false),
    highlight: (ids) => {
      ids.forEach((id) => hiddenObjects.delete(id));
      setSelection(ids, true);
    },
    onChange: render,
    onIdentityChange: syncIdentity,
  });
  controllers.planView = drawingController.planView;
  controllers.drawingManager = drawingController.manager;
  const numbering = installNumbering({
    getState: () => project,
    beforeOpen: () => {
      controllers.inspector?.finish();
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
        geometry = selectionGeometryReader(project.objects, {
          exactProfileIds: ui.exactProfileIds,
        }),
        selected = new Set(ids);
      for (const object of project.objects)
        if (selected.has(object.id)) bounds.union(geometry.bounds(object));
      if (!bounds.isEmpty()) {
        fit(undefined, bounds);
        frameGate.invalidate();
      }
    },
    onClose: () => controllers.drawingManager.render(),
  });
  controllers.drawingManager.openNumbering = (kinds) => numbering.open(kinds);
  const numberingButton = document.createElement('button');
  numberingButton.id = 'numbering-open';
  numberingButton.textContent = 'Numrering';
  numberingButton.onclick = () => numbering.open();
  document.querySelector('header .history').prepend(numberingButton);

  controllers.drawingController = drawingController;
}
