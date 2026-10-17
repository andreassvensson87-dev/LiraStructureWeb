import { setInspectorFieldState, inspectorFieldValue } from './field-state.js';
import { createAttributeRow } from './attributes.js';
/** Compact point context; transactions and selection belong to its model controller. */
export function createInsertionPointInspector(root, { preview, commit, reset, cancel }) {
  const panel = document.createElement('section');
  panel.id = 'insertion-point-inspector';
  panel.hidden = true;
  const title = document.createElement('h3'),
    count = document.createElement('p');
  title.textContent = 'Insättningspunkter';
  const row = createAttributeRow(
    { key: 'radius', label: 'Radie · mm', type: 'number' },
    { value: 0 },
  );
  const input = row.querySelector('input');
  input.min = '0';
  input.step = 'any';
  input.placeholder = 'Blandat';
  const buttons = document.createElement('div'),
    apply = document.createElement('button'),
    rollback = document.createElement('button'),
    error = document.createElement('p');
  buttons.className = 'inspector-inline';
  apply.type = rollback.type = 'button';
  apply.className = 'primary';
  apply.textContent = 'Modifiera';
  rollback.textContent = 'Återställ';
  error.setAttribute('role', 'alert');
  input.oninput = () => preview(input.value);
  apply.onclick = () => commit(input.value);
  rollback.onclick = reset;
  panel.addEventListener('input', (event) => event.stopPropagation());
  panel.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      commit(input.value);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    }
  });
  buttons.append(apply, rollback);
  panel.append(title, count, row, buttons, error);
  root.append(panel);
  let original = '';
  return {
    panel,
    input,
    error,
    sync({ total, value, disabled = false, dirty = false, valid = true }) {
      count.textContent = `${total} ${total === 1 ? 'punkt' : 'punkter'}`;
      if (document.activeElement !== input || !dirty)
        input.value = value == null ? '' : String(value);
      input.disabled = disabled;
      if (!dirty) original = inspectorFieldValue(input);
      const changed = dirty && inspectorFieldValue(input) !== original;
      setInspectorFieldState(input, { changed, invalid: !valid });
      apply.disabled = disabled || !changed || !valid;
      rollback.disabled = !dirty;
    },
  };
}
