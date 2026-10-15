import { planMarkChange, applyMarkChange } from '../numbering/mark-change.js';
import { partStatus } from '../part-marks.js';
import { createMarkChangeDialog } from '../ui/mark-change-dialog.js';

/** Numbering is a project transaction: model geometry stays untouched. */
export function installWorkspaceMarkChange({ actions, controllers, project, $ }) {
  let target;
  const dialog = createMarkChangeDialog({
    preview: (mark) => planMarkChange(project, target, mark),
    commit: (plan) => {
      const patch = applyMarkChange(plan, project);
      if (!patch) return;
      actions.checkpoint();
      Object.assign(project, patch);
      actions.render();
      controllers.drawingManager?.render();
      $('status').textContent = `${plan.previous} → ${plan.mark} · Kan ångras`;
    },
  });
  controllers.markChange = {
    open(next) {
      controllers.inspector?.finish();
      target = next;
      const mark =
        next.kind === 'part'
          ? partStatus(
              project.objects.find((o) => o.id === next.id),
              project.objects,
              project.parts,
            ).mark
          : project.assemblies.find((a) => a.id === next.id)?.mark;
      dialog.open(next.kind, mark || '');
    },
  };
}
