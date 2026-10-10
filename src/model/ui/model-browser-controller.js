import { ModelTree } from '../../model-tree.js';
import { isHelper } from '../../model-object.js';
import { ModelFilter } from '../../model-filter-ui.js';
import * as THREE from 'three';

export function installModelBrowser({
  $,
  actions,
  camera,
  controllers,
  hiddenObjects,
  objects,
  project,
  ui,
}) {
  const baseVisible = (...args) => actions.baseVisible(...args);
  const isVisible = (...args) => actions.isVisible(...args);
  const render = (...args) => actions.render(...args);
  const select = (...args) => actions.select(...args);
  const setDrawing = (...args) => actions.setDrawing(...args);
  const setSelection = (...args) => actions.setSelection(...args);
  const userSelection = (...args) => actions.userSelection(...args);
  Object.assign(actions, { changeVisibility });
  function changeVisibility(action) {
    controllers.inspector?.finish();
    setDrawing(false);
    action();
    controllers.modelFilter?.sync(project);
    ui.selectedIds = new Set([...ui.selectedIds].filter(isVisible));
    ui.selected = ui.selectedIds.size === 1 ? [...ui.selectedIds][0] : null;
    render();
  }
  controllers.modelTree = new ModelTree($('object-list'), {
    selectGroup: (ids, add) => {
      ids = [...userSelection(ids)];
      if (ids.some((id) => !controllers.modelFilter.allows(id))) {
        controllers.modelFilter.reset();
        controllers.modelFilter.sync(project);
      }
      ids.forEach((id) => hiddenObjects.delete(id));
      const selection = add ? new Set(ui.selectedIds) : new Set();
      const remove = add && ids.every((id) => selection.has(id));
      ids.forEach((id) => (remove ? selection.delete(id) : selection.add(id)));
      setSelection([...selection], true);
    },
    select: (id, add) => {
      if (!controllers.modelFilter.allows(id)) {
        controllers.modelFilter.reset();
        controllers.modelFilter.sync(project);
      }
      hiddenObjects.delete(id);
      if (isHelper(project.objects.find((s) => s.id === id))) ui.showHelpers = true;
      select(id, add, true);
    },
    selectable: (id) => actions.isSelectable(id),
    visible: isVisible,
    toggle: (id) =>
      changeVisibility(() => {
        if (isVisible(id)) hiddenObjects.add(id);
        else {
          if (!controllers.modelFilter.allows(id)) controllers.modelFilter.reset();
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
        controllers.modelFilter?.reset();
        ui.showHelpers = true;
      }),
  });
  const filterBounds = new WeakMap();
  controllers.modelFilter = new ModelFilter({
    inspector: controllers.inspector,
    baseVisible,
    change: () => {
      changeVisibility(() => controllers.modelFilter.sync(project));
      controllers.inspector.show('filter');
      $('status').textContent = controllers.modelFilter.active
        ? `Filter aktivt · ${controllers.modelFilter.matches.size} ${controllers.modelFilter.matches.size === 1 ? 'träff' : 'träffar'} av ${project.objects.length} objekt`
        : 'Alla modellfilter återställda';
    },
    showAll: () => {
      changeVisibility(() => {
        hiddenObjects.clear();
        ui.showHelpers = true;
      });
      controllers.inspector.show('filter');
      $('status').textContent = 'Alla objekt visas';
    },
    selectMatches: (ids) => {
      setSelection(ids, true);
      ui.selectedIds = new Set([...ui.selectedIds].filter(isVisible));
      ui.selected = ui.selectedIds.size === 1 ? [...ui.selectedIds][0] : null;
      render({ selectionOnly: true });
      controllers.inspector.show('filter');
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
}
