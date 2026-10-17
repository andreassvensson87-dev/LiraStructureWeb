import { bindInspectorField } from './inspector/field-state.js';
import { createEditorSection } from './ui/editor-surface.js';
import { insulationFrame, insulationSettings } from './drawing-insulation.js';

export function installInsulationInspector(editor, item) {
  if (item.shape !== 'insulation') return;
  const settings = insulationSettings(item);
  const fields = [];
  const commit = (key, value, checkpoint = true) => {
    if (item[key] === value) return;
    if (checkpoint && editor.items?.includes(item)) editor.checkpoint();
    item[key] = value;
    editor.adapter.redraw();
    for (const button of editor.panel.querySelectorAll('.annotation-history button'))
      button.disabled =
        button.textContent === 'Ångra' ? !editor.history.length : !editor.future.length;
  };
  const select = (title, key, choices) => {
    const label = document.createElement('label'),
      input = document.createElement('select');
    label.textContent = title;
    input.append(...choices.map(([value, name]) => new Option(name, value)));
    input.value = settings[key];
    input.onchange = () => commit(key, input.value);
    label.append(input);
    fields.push(label);
  };
  select('Typ', 'insulationType', [
    ['soft', 'Mjuk isolering'],
    ['hard', 'Hård isolering'],
  ]);
  const label = document.createElement('label'),
    input = document.createElement('input');
  label.textContent = 'Tjocklek · mm';
  input.type = 'number';
  input.min = 0.01;
  input.step = 'any';
  input.value = settings.thickness;
  let recorded = false;
  input.onfocus = () => {
    recorded = false;
  };
  input.oninput = () => {
    const value = Number(input.value);
    if (!input.value.trim() || !Number.isFinite(value) || value <= 0) {
      input.setCustomValidity('Ange en positiv isoleringstjocklek i mm.');
      return;
    }
    input.setCustomValidity('');
    commit('thickness', value, !recorded);
    recorded = true;
  };
  input.onblur = () => {
    if (!input.checkValidity()) {
      input.value = insulationSettings(item).thickness;
      input.setCustomValidity('');
    }
  };
  bindInspectorField(input, () => insulationSettings(item).thickness);
  label.append(input);
  fields.push(label);
  select('Sida från start till slut', 'side', [
    ['left', 'Vänster'],
    ['right', 'Höger'],
  ]);
  if (item.points?.length === 2) {
    const length = document.createElement('p');
    length.textContent = `Längd: ${Number(insulationFrame(item).length.toFixed(2))} mm`;
    fields.push(length);
  }
  editor.panel.append(createEditorSection('Isolering', fields));
}
