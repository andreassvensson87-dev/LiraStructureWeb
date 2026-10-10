import { LevelsUI, levelElevation } from '../levels.js';

export function installWorkspaceLevels({ $, actions, controllers, grid, project, ui }) {
  const checkpoint = (...args) => actions.checkpoint(...args);
  const render = (...args) => actions.render(...args);
  const setDrawing = (...args) => actions.setDrawing(...args);
  const updateForm = (...args) => actions.updateForm(...args);
  controllers.levelsUI = new LevelsUI({
    getState: () => project.levels,
    change: (next) => {
      controllers.inspector?.finish();
      checkpoint();
      setDrawing(false);
      project.levels = next;
      grid.set({ ...project.grid, modelObjects: true, z: levelElevation(project.levels) });
      controllers.levelsUI.sync();
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
}
