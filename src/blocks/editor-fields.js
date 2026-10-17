import { bindInspectorField } from '../inspector/field-state.js';
import { createAttributeRow } from '../inspector/attributes.js';
export function blockField(label, value, change, { type = 'text', options } = {}) {
  const row = createAttributeRow(
    { key: label, label, type: options ? 'select' : type, options },
    { value },
  );
  const control = row.querySelector('input,select');
  // Select choices use native options to share keyboard behavior across editors.
  if (options)
    control.replaceChildren(
      ...options.map(([key, text]) => new Option(text, key, false, String(key) === String(value))),
    );
  let previous = control.value;
  control.blockCommit = () => {
    if (control.value === previous) return true;
    const next = control.value,
      result = change(type === 'number' ? Number(next) : next);
    if (result === false) return false;
    previous = next;
    delete control.dataset.blockPending;
    return true;
  };
  control.oninput = () => {
    control.dataset.blockPending = '';
  };
  control.onchange = control.onblur = () => control.blockCommit();
  bindInspectorField(control, () => previous);
  return row;
}
export function flushBlockFields(root) {
  for (const control of root.querySelectorAll('[data-block-pending]'))
    if (control.blockCommit?.() === false)
      throw Error('Korrigera blockets ogiltiga fält före sparning.');
}
export function blockButton(label, run) {
  const node = document.createElement('button');
  node.type = 'button';
  node.textContent = label;
  node.onclick = run;
  return node;
}
