import { isHelper } from '../../model-object.js';
import { objectType } from '../object-types/index.js';
export function createHelperController({
  project,
  ui,
  tools,
  select,
  setDrawing,
  syncOperationUI,
  save,
  render,
  changeVisibility,
  renderer,
}) {
  const $ = (id) => document.getElementById(id);
  const toolbar = $('draw').parentElement;
  for (const [type, label, path] of [
    ['helperpoint', 'Hjälppunkt', 'M12 3v18M3 12h18'],
    ['helperline', 'Hjälplinje', 'M4 20 20 4M3 17v4h4M17 3h4v4'],
  ]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = type;
    button.title = label;
    button.setAttribute('aria-label', label);
    button.innerHTML = `<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.5"><path d="${path}"/></svg><span>${label}</span>`;
    toolbar.append(button);
    button.onclick = () => {
      select(null);
      ui.showHelpers = true;
      setDrawing(true);
      tools.operation = { mode: type };
      syncOperationUI();
      sync();
      $('properties-tab').click();
      renderer.domElement.focus({ preventScroll: true });
    };
  }
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.id = 'helpers-visible';
  toggle.title = 'Visa hjälplinjer och hjälppunkter';
  toggle.setAttribute('aria-label', 'Visa hjälpobjekt');
  toggle.innerHTML =
    '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12h18M12 3v18" stroke-dasharray="3 2"/><circle cx="12" cy="12" r="3"/></svg>';
  document.querySelector('.view-controls').append(toggle);
  toggle.onclick = () =>
    changeVisibility(() => {
      ui.showHelpers = !ui.showHelpers;
    });
  const form = document.createElement('form');
  form.id = 'helper-form';
  form.hidden = true;
  for (const key of ['start', 'end']) {
    const group = document.createElement('fieldset');
    group.dataset.helperGroup = key;
    const legend = document.createElement('legend');
    legend.textContent = key === 'start' ? 'Punkt / start · mm' : 'Slut · mm';
    group.append(legend);
    const row = document.createElement('div');
    row.className = 'dimensions';
    ['X', 'Y', 'Z'].forEach((axis, i) => {
      const label = document.createElement('label');
      label.textContent = axis;
      const input = document.createElement('input');
      input.type = 'number';
      input.step = 'any';
      input.required = true;
      input.dataset.helperCoord = `${key}:${i}`;
      input.setAttribute('aria-label', `${key === 'start' ? 'Start' : 'Slut'} ${axis}`);
      label.append(input);
      row.append(label);
    });
    group.append(row);
    form.append(group);
  }
  const create = document.createElement('button');
  create.type = 'submit';
  create.textContent = 'Skapa';
  form.append(create);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = 'Ta bort markerad';
  remove.onclick = () => $('delete').click();
  form.append(remove);
  $('form').after(form);
  form.onsubmit = (e) => {
    e.preventDefault();
    if (!tools.operation?.mode.startsWith('helper')) return;
    const draft = { type: tools.operation.mode };
    for (const key of ['start', 'end'])
      if (key === 'start' || draft.type === 'helperline')
        draft[key] = [...form.querySelectorAll(`[data-helper-coord^="${key}:"]`)].map((input) =>
          Number(input.value),
        );
    save(draft);
  };
  function sync() {
    const selected = project.objects.find((s) => s.id === ui.selected),
      creating = tools.operation?.mode.startsWith('helper');
    const type = creating ? tools.operation.mode : isHelper(selected) ? selected.type : null;
    form.hidden = !type;
    for (const id of ['helperpoint', 'helperline']) {
      $(id).classList.toggle('active', tools.operation?.mode === id);
      $(id).setAttribute('aria-pressed', String(tools.operation?.mode === id));
    }
    toggle.setAttribute('aria-pressed', String(ui.showHelpers));
    if (!type) return;
    $('form').hidden = $('plate-form').hidden = true;
    $('material-panel').hidden = true;
    $('object-heading').textContent = objectType({ type }).label;
    $('mode-label').textContent = creating
      ? 'Ny ' + objectType({ type }).label.toLowerCase()
      : selected.name;
    form.inert = !!tools.operation && !creating;
    form.querySelector('[data-helper-group=end]').hidden = type === 'helperpoint';
    create.hidden = !creating;
    remove.hidden = !!creating;
    for (const input of form.querySelectorAll('input')) {
      const [key, index] = input.dataset.helperCoord.split(':');
      input.value = selected?.[key]?.[index] ?? (key === 'end' && index === '0' ? 3000 : 0);
      input.disabled = key === 'end' && type === 'helperpoint';
    }
  }
  return { sync };
}
