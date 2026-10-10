import { isPlate, isPhysical } from '../../model-object.js';
import { installModelWorkspace } from '../../ui/model-workspace.js';

export function installModelToolbox({ $, project, ui, actions, controllers }) {
  const startPlate = (...args) => actions.startPlate(...args);
  $('linecut').onclick = () => {
    const targets = project.objects
      .filter((s) => ui.selectedIds.has(s.id) && !isPlate(s) && isPhysical(s))
      .map((s) => s.id);
    if (targets.length) startPlate(targets, true);
  };
  $('polygoncut').onclick = () => {
    const targets = project.objects
      .filter((s) => ui.selectedIds.has(s.id) && isPhysical(s))
      .map((s) => s.id);
    if (targets.length) startPlate(targets);
  };
  for (const [id, key] of [
    ['move', 'M'],
    ['copy', 'C'],
    ['rotate', 'R'],
  ]) {
    $(id).title = `${$(id).getAttribute('aria-label')} (Ctrl+${key})`;
    $(id).setAttribute('aria-keyshortcuts', `Control+${key} Meta+${key}`);
  }
  const editGridButton = document.createElement('button');
  editGridButton.type = 'button';
  editGridButton.id = 'edit-grid';
  editGridButton.setAttribute('aria-label', 'Skapa stomlinje');
  editGridButton.title = 'Skapa stomlinje';
  editGridButton.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 3v18M18 3v18M3 6h18M3 18h18"/></svg><span>Stomlinjer</span>';
  editGridButton.onclick = () => controllers.helperController.create('gridline');
  const root = document.querySelector('.toolbox');
  root.append(editGridButton);
  installModelWorkspace({ root, controllers });
}
