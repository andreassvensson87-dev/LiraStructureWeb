import { ProjectAutosave } from './project-recovery.js';
import { setupPWA } from './pwa.js';
import { commandIcon } from '../ui/icons.js';

export function installWorkspaceRecovery({
  $,
  actions,
  controllers,
  project,
  projectHistory,
  projectRecovery,
  recoveredProject,
  recoveryError,
}) {
  const fillSettings = (...args) => actions.fillSettings(...args);
  const fit = (...args) => actions.fit(...args);
  const render = (...args) => actions.render(...args);
  if (recoveredProject) {
    projectHistory.prime(project);
    controllers.referenceModels.restore(project.references);
    fillSettings();
    render();
    fit();
    $('status').textContent =
      `${recoveredProject.backup ? 'Säkerhetskopia' : 'Autosparat projekt'} återställt · ${project.objects.length} objekt`;
  }
  const autosaveStatus = document.createElement('span');
  autosaveStatus.className = 'project-autosave-status';
  autosaveStatus.setAttribute('role', 'status');
  const statusText = document.createElement('span');
  statusText.className = 'project-autosave-text';
  autosaveStatus.append(commandIcon('save'), statusText);
  const updateSaveStatus = (message, error = false) => {
    statusText.textContent = message;
    autosaveStatus.title = message;
    autosaveStatus.classList.toggle('save-error', !!error);
    autosaveStatus.classList.toggle('save-pending', !error && message === 'Sparar lokalt…');
  };
  updateSaveStatus(
    recoveryError || (recoveredProject ? 'Återställt från lokal sparning' : 'Autosparning aktiv'),
    !!recoveryError,
  );
  document.querySelector('body > footer').append(autosaveStatus);
  controllers.projectAutosave = new ProjectAutosave({
    recovery: projectRecovery,
    getProject: () => project,
    status: updateSaveStatus,
  });
  // Form edits also cover project settings, drawing/report records and snap preferences.
  for (const event of ['input', 'change'])
    document.addEventListener(event, () => controllers.projectAutosave.schedule());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) controllers.projectAutosave.flush().catch(() => {});
  });
  window.addEventListener('pagehide', () => controllers.projectAutosave.flush().catch(() => {}));
  window.addEventListener('beforeunload', (event) => {
    if (!controllers.projectAutosave.dirty && !controllers.projectAutosave.saving) return;
    controllers.projectAutosave.flush().catch(() => {});
    event.preventDefault();
    event.returnValue = '';
  });
  setupPWA(async () => {
    controllers.inspector.finish();
    await controllers.projectAutosave.flush();
  });
}
