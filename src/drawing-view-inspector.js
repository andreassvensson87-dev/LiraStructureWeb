import { createEditorSection } from './ui/editor-surface.js';
import {
  bindInspectorField,
  createInspectorDraft,
  setInspectorFieldState,
} from './inspector/field-state.js';
export function createDrawingViewInspector(
  parent,
  { selected, changed, selectedViews = () => (selected() ? [selected()] : []), move },
) {
  const section = createEditorSection('Placering på bladet', []);
  section.classList.add('drawing-view-placement');
  const grid = document.createElement('div');
  grid.className = 'drawing-view-fields';
  section.append(grid);
  const fields = section.querySelector('div'),
    inputs = [];
  for (const [key, axis, text] of [
    ['position', 0, 'X · mm'],
    ['position', 1, 'Y · mm'],
    ['size', 0, 'Bredd · mm'],
    ['size', 1, 'Höjd · mm'],
  ]) {
    const label = document.createElement('label');
    label.textContent = text;
    const input = document.createElement('input');
    input.type = 'number';
    input.step = 'any';
    input.setAttribute('aria-label', 'Vy · ' + text);
    if (key === 'size') input.min = '15';
    input.onchange = () => {
      const view = selected(),
        value = Number(input.value);
      if (!view || !input.value || !Number.isFinite(value) || (key === 'size' && value < 15)) {
        sync();
        return;
      }
      changed(view, key, axis, value);
      sync();
    };
    bindInspectorField(input, () =>
      selected()?.[key]?.[axis] == null ? '' : Math.round(selected()[key][axis] * 1000) / 1000,
    );
    label.append(input);
    fields.append(label);
    inputs.push({ input, key, axis });
  }
  const batch = document.createElement('div');
  batch.className = 'drawing-view-batch-move';
  const offsets = ['X', 'Y'].map((axis) => {
    const label = document.createElement('label');
    label.textContent = 'Flytta ' + axis + ' · mm';
    const input = document.createElement('input');
    input.type = 'number';
    input.step = 'any';
    input.value = '0';
    label.append(input);
    batch.append(label);
    return input;
  });
  const fieldDraft = createInspectorDraft(batch);
  const apply = document.createElement('button');
  apply.type = 'button';
  apply.textContent = 'Flytta markerade vyer';
  apply.onclick = () => {
    const values = offsets.map((input) => (input.value.trim() ? Number(input.value) : NaN));
    if (values.every(Number.isFinite)) {
      move?.(...values);
      offsets.forEach((input) => (input.value = '0'));
      fieldDraft.accept();
      sync();
    }
  };
  batch.append(apply);
  section.append(batch);
  parent.append(section);
  function sync() {
    const views = selectedViews(),
      view = selected();
    section.hidden = !views.length;
    const multiple = views.length > 1;
    section.querySelector('summary').textContent = multiple
      ? views.length + ' vyer markerade'
      : 'Placering på bladet';
    fields.hidden = multiple;
    batch.hidden = !multiple;
    if (!view) return;
    for (const { input, key, axis } of inputs) {
      input.value = String(Math.round(view[key][axis] * 1000) / 1000);
      setInspectorFieldState(input);
    }
  }
  return { sync };
}
