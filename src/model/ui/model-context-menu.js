import { ObjectInformation } from './object-information.js';
import { isPhysical } from '../../model-object.js';
import { partStatus } from '../../part-marks.js';
import { setModelProfilesExact, hasExactProfile } from '../../profile-detail.js';

export function installModelContextMenu({ $, actions, controllers, project, renderer, tools, ui }) {
  const render = (...args) => actions.render(...args);
  const setDrawing = (...args) => actions.setDrawing(...args);
  const syncOperationUI = (...args) => actions.syncOperationUI(...args);
  const assemblyMenu = document.createElement('div');
  assemblyMenu.className = 'annotation-context-menu model-context-menu';
  assemblyMenu.hidden = true;
  assemblyMenu.setAttribute('role', 'menu');
  const addAssemblyButton = document.createElement('button');
  addAssemblyButton.type = 'button';
  addAssemblyButton.setAttribute('role', 'menuitem');
  addAssemblyButton.textContent = 'Lägg till i assembly';
  assemblyMenu.append(addAssemblyButton);
  const profileMenuButton = (label, action) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'menuitem');
    button.textContent = label;
    button.onclick = () => {
      assemblyMenu.hidden = true;
      action();
      render();
    };
    assemblyMenu.append(button);
    return button;
  };
  const objectInformation = new ObjectInformation({
    getObjects: () => project.objects.filter((s) => ui.selectedIds.has(s.id)),
    getModel: () => project.objects,
    partLabel: (s) => (isPhysical(s) ? partStatus(s, project.objects, project.parts).label : '—'),
  });
  const informationButton = profileMenuButton('Information', () => {
    controllers.inspector?.finish();
    objectInformation.open();
  });
  const showExactButton = profileMenuButton('Visa exakt', () => {
    setModelProfilesExact(ui, project.objects, ui.selectedIds, true);
    $('status').textContent = 'Markerade profiler visas exakt med radier';
  });
  const showSchematicButton = profileMenuButton('Visa schematiskt', () => {
    setModelProfilesExact(ui, project.objects, ui.selectedIds, false);
    $('status').textContent = 'Markerade profiler visas schematiskt utan radier';
  });
  const redrawViewButton = profileMenuButton('Rita om vyn', () => {
    ui.exactProfileIds.clear();
    $('status').textContent = 'Vyn omritad · alla profiler visas schematiskt';
  });
  redrawViewButton.title = 'Återställ alla profiler i modellen till schematisk visning';
  document.body.append(assemblyMenu);
  renderer.domElement.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    if (tools.drawing || tools.operation) return;
    const selected = project.objects.filter((s) => ui.selectedIds.has(s.id));
    informationButton.disabled = !selected.length;
    const profiles = selected.filter(hasExactProfile);
    showExactButton.disabled =
      !profiles.length || profiles.every((s) => ui.exactProfileIds.has(s.id));
    showSchematicButton.disabled = !profiles.some((s) => ui.exactProfileIds.has(s.id));
    addAssemblyButton.disabled = !selected.length || selected.some((s) => !isPhysical(s));
    assemblyMenu.hidden = false;
    assemblyMenu.style.left = `${Math.max(0, Math.min(event.clientX, innerWidth - assemblyMenu.offsetWidth))}px`;
    assemblyMenu.style.top = `${Math.max(0, Math.min(event.clientY, innerHeight - assemblyMenu.offsetHeight))}px`;
    addAssemblyButton.focus();
  });
  // Capture outside presses before model selection consumes the pointer event.
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (!assemblyMenu.contains(event.target)) assemblyMenu.hidden = true;
    },
    true,
  );
  assemblyMenu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      assemblyMenu.hidden = true;
      renderer.domElement.focus({ preventScroll: true });
    }
  });
  addAssemblyButton.onclick = () => {
    controllers.inspector?.finish();
    const secondaryIds = [...ui.selectedIds];
    assemblyMenu.hidden = true;
    setDrawing(false);
    tools.operation = { mode: 'assemblyMain', secondaryIds };
    syncOperationUI();
    renderer.domElement.style.cursor = 'crosshair';
    $('status').textContent = 'Assembly · Klicka på huvuddelen · Escape avbryter';
    renderer.domElement.focus({ preventScroll: true });
  };

  controllers.assemblyMenu = assemblyMenu;
}
