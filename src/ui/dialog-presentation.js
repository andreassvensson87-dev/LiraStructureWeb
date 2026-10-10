import { adoptAttributeLabel } from '../inspector/attributes.js';

/** Adopt form controls without replacing IDs, validation or action handlers. */
export function installDialogPresentation(dialog) {
  dialog.classList.add('ui-standard-dialog');
  dialog.querySelectorAll('label').forEach((label) => {
    if (!label.querySelector('input[type=checkbox]')) adoptAttributeLabel(label);
  });
}

/** Shared frame for task dialogs with lists, forms and an action bar. */
export function installManagementDialog(dialog) {
  installDialogPresentation(dialog);
  dialog.classList.add('ui-managed-dialog');
  dialog.querySelectorAll('table').forEach((table) => table.classList.add('ui-dialog-table'));
}
