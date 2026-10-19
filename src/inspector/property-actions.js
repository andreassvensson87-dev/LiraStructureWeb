import { installInspectorEnter } from './enter.js';
import { createAttributeRow } from './attributes.js';

/** Shared copy/default actions. Selection, validation, preview and commits belong to adapters. */
export function createPropertyActions({ copy, defaults, apply, cancel, changed }) {
  const root = document.createElement('section');
  root.className = 'object-property-copy property-transfer-actions';
  root.dataset.independentEditor = '';
  const caption = document.createElement('h3');
  caption.textContent = 'Kopiera egenskaper';
  const actions = document.createElement('div');
  actions.className = 'sweep-copy-actions';
  const button = (text, action) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.onclick = () => run(action);
    actions.append(b);
    return b;
  };
  const start = button('Kopiera egenskaper', copy);
  const use = button('Använd vid skapande', defaults);
  for (const b of [start, use]) b.onpointerdown = (event) => event.preventDefault();
  const abort = button('Avbryt', cancel);
  const confirm = button('Modifiera', apply);
  confirm.className = 'primary';
  const fields = document.createElement('div');
  fields.className = 'attribute-fields';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.hidden = true;
  const error = document.createElement('p');
  error.setAttribute('role', 'alert');
  error.hidden = true;
  root.append(caption, fields, actions, status, error);
  installInspectorEnter(root, () => {
    if (!confirm.disabled) run(apply);
  });
  for (const event of ['input', 'change']) root.addEventListener(event, (e) => e.stopPropagation());
  function run(action) {
    try {
      error.hidden = true;
      action();
    } catch (e) {
      error.textContent = e.message;
      error.hidden = false;
    }
  }
  return {
    root,
    message(text) {
      status.textContent = text;
      status.hidden = !text;
    },
    sync({
      visible,
      copying,
      choices = [],
      selected = [],
      canApply,
      canDefault = true,
      count = 0,
    }) {
      root.hidden = !visible;
      caption.hidden = !copying;
      start.hidden = use.hidden = copying;
      abort.hidden = confirm.hidden = !copying;
      use.disabled = !canDefault;
      confirm.disabled = !canApply;
      fields.replaceChildren();
      if (!copying) status.hidden = true;
      if (copying) {
        for (const field of choices) {
          const row = createAttributeRow(
            { ...field, type: 'checkbox' },
            { value: selected.includes(field.key), onChange: (key, value) => changed(key, value) },
          );
          row.querySelector('input').disabled = !!field.disabled;
          fields.append(row);
        }
        status.textContent = `${count} mål · välj objekt och bekräfta med Modifiera`;
        status.hidden = false;
      }
    },
    run,
  };
}
