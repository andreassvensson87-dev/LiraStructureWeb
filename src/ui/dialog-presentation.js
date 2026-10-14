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

/** Reusable confirmation frame; the caller owns the decision and resulting operation. */
export function createConfirmationDialog({ title, acceptLabel, cancelLabel }) {
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-label', title);
  const heading = document.createElement('h2');
  heading.textContent = title;
  const message = document.createElement('p');
  const actions = document.createElement('div');
  actions.className = 'settings-actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = cancelLabel;
  const accept = document.createElement('button');
  accept.type = 'button';
  accept.className = 'primary';
  accept.textContent = acceptLabel;
  actions.append(cancel, accept);
  dialog.append(heading, message, actions);
  document.body.append(dialog);
  installDialogPresentation(dialog);
  let resolve = null;
  cancel.onclick = () => dialog.close('cancel');
  accept.onclick = () => dialog.close('accept');
  dialog.addEventListener('close', () => {
    const done = resolve;
    resolve = null;
    done?.(dialog.returnValue === 'accept');
  });
  return {
    ask(text) {
      message.textContent = text;
      dialog.returnValue = '';
      dialog.showModal();
      cancel.focus();
      return new Promise((done) => {
        resolve = done;
      });
    },
  };
}
