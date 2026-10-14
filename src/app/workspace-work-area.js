import { validateWorkArea, expandWorkArea } from '../model/work-area.js';
import { createConfirmationDialog } from '../ui/dialog-presentation.js';

/** Owns persisted view-setting transactions and reference expansion decisions. */
export function installWorkspaceWorkArea({ project, actions, controllers }) {
  const dialog = createConfirmationDialog({
    title: 'Utöka arbetsområdet?',
    acceptLabel: 'Utöka',
    cancelLabel: 'Behåll boxen',
  });
  let queue = Promise.resolve();
  function setWorkArea(next) {
    validateWorkArea(next);
    if (JSON.stringify(next) === JSON.stringify(project.workArea)) return;
    actions.checkpoint();
    project.workArea = structuredClone(next);
    actions.render();
  }
  function referenceExtentChanged(model) {
    controllers.referenceModels?.setWorkArea(controllers.workAreaUI?.bounds() || null);
    queue = queue
      .then(async () => {
        const references = controllers.referenceModels;
        if (!model.group.visible || references?.models.find((m) => m.id === model.id) !== model)
          return;
        const before = JSON.stringify(project.workArea),
          bounds = references.modelBounds(model);
        const next = expandWorkArea(project.workArea, bounds);
        if (!next) return;
        const accepted = await dialog.ask(
          `${model.title || model.fileName} ligger utanför arbetsområdet. Vill du utöka boxen så att hela referensen syns?`,
        );
        if (
          accepted &&
          before === JSON.stringify(project.workArea) &&
          references.models.includes(model)
        ) {
          const fresh = expandWorkArea(project.workArea, references.modelBounds(model));
          if (fresh) {
            setWorkArea(fresh);
            actions.fit();
          }
        }
      })
      .catch((error) => {
        document.getElementById('status').textContent = error.message;
      });
  }
  Object.assign(actions, { setWorkArea, referenceExtentChanged });
}
