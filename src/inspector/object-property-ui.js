import { designation } from '../object-identity.js';
import { mountAttributeLayout, setAttributeMessage } from './attributes.js';

export function createObjectPropertyUI({
  getState,
  start,
  toggle,
  apply,
  cancel,
  highlight,
  schema,
}) {
  const { key: family, editable, mode, noun, className: panelClass } = schema;
  const panel = document.getElementById('inspector-properties');
  const layout = mountAttributeLayout(panel, schema, sync);
  const root = document.createElement('section');
  root.id = `${family}-property-copy`;
  root.className = 'object-property-copy';
  root.hidden = true;
  root.setAttribute('data-independent-editor', '');
  root.innerHTML =
    '<button type="button" data-start>Kopiera till andra…</button><p data-copy-status role="status" hidden></p><div class="sweep-copy-actions" hidden><button type="button" data-cancel>Avbryt</button><button type="button" data-apply class="primary">Modifiera</button></div><p data-copy-error role="alert" hidden></p>';
  document.getElementById('inspector-properties').append(root);
  root.addEventListener('input', (e) => e.stopPropagation());
  root.addEventListener('change', (e) => e.stopPropagation());
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && getState().operation?.mode === mode) {
      e.preventDefault();
      e.stopPropagation();
      confirm();
    }
  });
  const error = (message = '') => {
    setAttributeMessage(root.querySelector('[data-copy-error]'), message);
  };
  const groups = () => layout.selection.keys();
  root.querySelector('[data-start]').onclick = () => {
    try {
      if (!groups().length) throw new Error('Välj minst en egenskap att kopiera.');
      error();
      start(groups());
      sync();
    } catch (e) {
      error(e.message);
    }
  };
  root.querySelector('[data-cancel]').onclick = () => {
    error();
    cancel();
    sync();
  };
  root.querySelector('[data-apply]').onclick = confirm;
  function confirm() {
    try {
      apply(groups());
      error();
      sync();
    } catch (e) {
      error(e.message);
    }
  }
  function sync() {
    const { selected, operation, drawing } = getState(),
      active = operation?.mode === mode;
    const visible =
      selected.length === 1 && editable(selected[0]) && (!operation || active) && !drawing;
    root.hidden = !visible;
    const compact =
      (selected.length === 1 && editable(selected[0])) ||
      (!selected.length && schema.isCreating({ drawing, operation }));
    layout.sync({
      compact,
      copyVisible: visible,
      copying: active,
      state: { selected, operation, drawing },
    });
    document.getElementById('inspector-properties').classList.toggle(panelClass, compact);
    if (compact && selected.length === 1)
      document.getElementById('mode-label').textContent = designation(selected[0]);
    const identity = document.getElementById('sweep-identity-details');
    if (identity) identity.hidden = document.getElementById('identity-fields').hidden;
    root.querySelector('[data-start]').hidden = active;
    root.querySelector('.sweep-copy-actions').hidden = !active;
    const p = root.querySelector('[data-copy-status]');
    p.hidden = !active;
    if (active) {
      p.textContent = `${operation.targetIds.length} mål valda · Klicka på ${noun} i modellen och sedan Modifiera. Klicka igen för att avmarkera.`;
      root.querySelector('[data-apply]').disabled = !operation.targetIds.length || !groups().length;
      highlight([operation.source.id, ...operation.targetIds]);
    }
    if (!visible) error();
  }
  function pick(object) {
    try {
      if (!editable(object))
        throw new Error(
          `Välj ${noun === 'plåtar' ? 'en fristående plåt' : 'en sweep'} i modellen.`,
        );
      toggle(object.id);
      error();
      sync();
    } catch (e) {
      error(e.message);
    }
  }
  return { sync, pick, confirm };
}
