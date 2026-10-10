import { createRibbon } from './ribbon.js';
import { setLibraryTreeExpanded } from './library-tree.js';
import { adoptAttributeLabel } from '../inspector/attributes.js';

/** One library shell; controls and their domain handlers remain owned by adapters. */
export function installLibraryWorkspace(
  dialog,
  { search, tree, details, commands = [], actions = [], refresh, form, save, edit, use, message },
) {
  dialog.classList.add('ui-standard-library');
  const toolbar = document.createElement('div');
  toolbar.className = 'ui-library-toolbar';
  toolbar.setAttribute('aria-label', 'Biblioteksverktyg');
  dialog.querySelector(':scope > header, :scope > .panel-title').after(toolbar);
  createRibbon(toolbar, [{ label: 'Bibliotek', items: commands }]);
  const body = document.createElement('div');
  body.className = 'ui-library-body';
  const browser = document.createElement('section');
  browser.className = 'ui-library-browser';
  const searchRow = document.createElement('div');
  searchRow.className = 'ui-library-search-row';
  search.type = 'search';
  const treeActions = document.createElement('div');
  treeActions.className = 'ui-library-tree-actions';
  for (const [label, open] of [
    ['Fäll ihop', false],
    ['Visa alla', true],
  ]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.onclick = () => {
      search.value = '';
      refresh();
      setLibraryTreeExpanded(tree, open);
    };
    treeActions.append(button);
  }
  searchRow.append(search, treeActions);
  browser.append(searchRow, tree);
  const detailPanel = document.createElement('section');
  detailPanel.className = 'ui-library-details';
  detailPanel.append(details);
  details.querySelectorAll('label.field').forEach(adoptAttributeLabel);
  let gate;
  if (form) {
    gate = document.createElement('fieldset');
    gate.className = 'ui-library-edit-gate';
    form.before(gate);
    gate.append(form);
    form.id ||= `${dialog.id}-form`;
    if (save) save.setAttribute('form', form.id);
  }
  body.append(browser, detailPanel);
  const footer = document.createElement('footer');
  if (edit) edit.textContent = 'Redigera';
  if (use) use.textContent = 'Använd';
  footer.className = 'ui-library-footer';
  const status = document.createElement('div');
  status.className = 'ui-library-status';
  if (message) status.append(message);
  footer.append(status, ...actions, ...[edit, save, use].filter(Boolean));
  toolbar.after(body);
  dialog.append(footer);
  for (const old of dialog.querySelectorAll(':scope > footer'))
    if (old !== footer) {
      dialog.append(...old.querySelectorAll('input[type=file]'));
      old.remove();
    }
  const setEditing = (editing) => {
    detailPanel.classList.toggle('is-editing', editing);
    if (gate) gate.disabled = !editing;
    if (save) save.hidden = !editing;
    if (edit) edit.hidden = editing;
    if (use) use.hidden = editing;
  };
  if (form && edit)
    edit.onclick = () => {
      setEditing(true);
      form.querySelector('input:not([type=hidden]),select')?.focus();
    };
  setEditing(false);
  return { body, browser, details: detailPanel, toolbar, footer, setEditing, use, edit, save };
}

export function installItemLibraryLayout(dialog, refresh) {
  const find = (name) => dialog.querySelector(`[data-${name}]`);
  const command = (name, label) => ({ node: find(name), label });
  const details = dialog.querySelector('.item-library-properties');
  const layout = installLibraryWorkspace(dialog, {
    search: find('search'),
    tree: find('tree'),
    details,
    refresh,
    commands: [
      {
        label: 'Importera',
        icon: 'library',
        menu: [
          command('import', 'Importera STEP…'),
          command('import-library', 'Importera bibliotek…'),
        ],
      },
      command('export', 'Exportera'),
      {
        label: 'Mappar',
        icon: 'library',
        menu: [command('new-folder'), command('edit-folder'), command('delete-folder')],
      },
      command('delete', 'Ta bort item'),
    ],
    edit: find('edit'),
    use: find('use'),
    message: find('status'),
    actions: [find('cancel-import')],
  });
  // Keep the import drop target and destination below the tree, using the same controller.
  layout.browser.append(dialog.querySelector('.item-drop'), find('count'));
  dialog.querySelector('.item-library-layout').remove();
  return layout;
}
