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
  function nextLabel(axis) {
    const used = new Set(project.objects.filter((s) => s.type === 'gridline').map((s) => s.name));
    let i = 1;
    const name = () => (axis === 'x' ? String(i) : i <= 26 ? String.fromCharCode(64 + i) : `A${i}`);
    while (used.has(name())) i++;
    return name();
  }
  const isCreating = () =>
    ['helperline', 'helperpoint', 'gridline'].includes(tools.operation?.mode);
  function start(type) {
    select(null);
    ui.showHelpers = true;
    setDrawing(true);
    tools.operation = { mode: type };
    syncOperationUI();
    sync();
    $('properties-tab').click();
    renderer.domElement.focus({ preventScroll: true });
  }
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
    button.onclick = () => start(type);
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
  const gridFields = document.createElement('div');
  gridFields.innerHTML = `<label class="field">Beteckning<input data-grid-name data-common="name" maxlength="40" aria-label="Stomlinjebeteckning"></label><label class="field">Serie<select data-grid-axis data-common="gridAxis" aria-label="Stomlinjeserie"><option value="x">1, 2, 3…</option><option value="y">A, B, C…</option></select></label><label class="field">Bubblor<select data-grid-bubbles data-common="bubbleEnds" aria-label="Stomlinjebubblor"><option value="both">Båda ändar</option><option value="start">Start</option><option value="end">Slut</option></select></label>`;
  form.prepend(gridFields);
  gridFields.querySelector('[data-grid-axis]').addEventListener('change', () => {
    if (isCreating())
      gridFields.querySelector('[data-grid-name]').value = nextLabel(
        gridFields.querySelector('[data-grid-axis]').value,
      );
  });
  const gridDraft = () => ({
    name: gridFields.querySelector('[data-grid-name]').value.trim(),
    gridAxis: gridFields.querySelector('[data-grid-axis]').value,
    bubbleEnds: gridFields.querySelector('[data-grid-bubbles]').value,
  });
  function draft() {
    const selected = project.objects.find((s) => s.id === ui.selected);
    const type = isCreating() ? tools.operation.mode : selected?.type;
    const result = { ...(selected || {}), type, ...(type === 'gridline' ? gridDraft() : {}) };
    for (const key of ['start', 'end'])
      if (key === 'start' || type !== 'helperpoint')
        result[key] = [...form.querySelectorAll(`[data-helper-coord^="${key}:"]`)].map((input) =>
          Number(input.value),
        );
    return result;
  }
  const shapeFields = document.createElement('div');
  shapeFields.innerHTML =
    '<label class="field">Längd · mm<input data-grid-length data-common="gridLength" type="number" min="1" step="any" aria-label="Stomlinjelängd"></label><label class="field">Vinkel · °<input data-grid-angle data-common="gridAngle" type="number" step="any" aria-label="Stomlinjevinkel"></label>';
  form.insertBefore(shapeFields, create);
  $('form').after(form);
  form.onsubmit = (e) => {
    e.preventDefault();
    if (isCreating()) save(draft());
  };
  function sync() {
    const selected = project.objects.find((s) => s.id === ui.selected),
      creating = isCreating();
    const type = creating ? tools.operation.mode : isHelper(selected) ? selected.type : null;
    form.hidden = !type;
    form.dataset.objectType = type || '';
    for (const id of ['helperpoint', 'helperline']) {
      $(id).classList.toggle('active', tools.operation?.mode === id);
      $(id).setAttribute('aria-pressed', String(tools.operation?.mode === id));
    }
    toggle.setAttribute('aria-pressed', String(ui.showHelpers));
    if (!type) return;
    gridFields.hidden = type !== 'gridline';
    shapeFields.hidden = type !== 'gridline' || creating;
    if (selected?.type === 'gridline') {
      shapeFields.querySelector('[data-grid-length]').value = Math.hypot(
        ...selected.end.map((v, i) => v - selected.start[i]),
      ).toFixed(3);
      shapeFields.querySelector('[data-grid-angle]').value = (
        (Math.atan2(selected.end[1] - selected.start[1], selected.end[0] - selected.start[0]) *
          180) /
        Math.PI
      ).toFixed(3);
    }
    if (type === 'gridline') {
      gridFields.querySelector('[data-grid-name]').value = selected?.name || nextLabel('x');
      gridFields.querySelector('[data-grid-axis]').value = selected?.gridAxis || 'x';
      gridFields.querySelector('[data-grid-bubbles]').value = selected?.bubbleEnds || 'both';
      $('inspector-identity').hidden = true;
      $('identity-fields').hidden = true;
    }
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
    for (const input of form.querySelectorAll('[data-helper-coord]')) {
      const [key, index] = input.dataset.helperCoord.split(':');
      input.value = selected?.[key]?.[index] ?? (key === 'end' && index === '0' ? 3000 : 0);
      input.disabled = key === 'end' && type === 'helperpoint';
    }
  }
  return { sync, create: start, gridDraft };
}
