import { bindInspectorField } from './inspector/field-state.js';
import { insulationDefaults } from './drawing-insulation.js';
import { installDrawingHatch } from './drawing-object-inspector.js';
import { createEditorSection } from './ui/editor-surface.js';
export const shapeLineTypes = {
  solid: 'Heldragen',
  dashed: 'Streckad',
  dotted: 'Prickad',
  center: 'Centrumlinje',
};
const styleKeys = [
  'strokeColor',
  'strokeWidth',
  'lineType',
  'fillColor',
  'hatch',
  'drawOrder',
  'insulationType',
  'thickness',
  'side',
];
export function shapeToolSettings(record, shape) {
  const settings = (record.shapeToolSettings ??= {});
  return (settings[shape] ??= { shape, ...(shape === 'insulation' ? insulationDefaults : {}) });
}
export function applyShapeToolSettings(draft, settings) {
  for (const key of styleKeys) {
    if (settings[key] === undefined) delete draft[key];
    else draft[key] = structuredClone(settings[key]);
  }
  return draft;
}
const color = (value) => /^#[\da-f]{6}$/i.test(value || '');
export function shapeStyle(item, preset = {}, unit = 1) {
  const width =
    Number.isFinite(item.strokeWidth) && item.strokeWidth >= 0.05 && item.strokeWidth <= 5
      ? item.strokeWidth
      : (preset.lineWidth ?? 0.22);
  const patterns = { dashed: [4, 2], dotted: [0.3, 1.5], center: [8, 2, 1, 2] };
  return {
    color: color(item.strokeColor) ? item.strokeColor : '#263a42',
    width: width * unit,
    lineType: shapeLineTypes[item.lineType] ? item.lineType : 'solid',
    dash: (patterns[item.lineType] || []).map((v) => v * unit).join(' '),
    fill: color(item.fillColor) ? item.fillColor : 'none',
  };
}
export function installShapeStyle(editor, item) {
  const { panel } = editor,
    style = shapeStyle(item, editor.record?.drawingPreset);
  const historyButtons = () => {
    for (const b of panel.querySelectorAll('.annotation-history button'))
      b.disabled = b.textContent === 'Ångra' ? !editor.history.length : !editor.future.length;
  };
  const input = (labelText, key, type, value, valid) => {
    const label = document.createElement('label'),
      field = document.createElement('input');
    label.textContent = labelText;
    field.type = type;
    field.value = value;
    if (type === 'number') {
      field.min = 0.05;
      field.max = 5;
      field.step = 'any';
    }
    let recorded = false;
    field.onfocus = () => {
      recorded = false;
    };
    field.oninput = () => {
      const value = type === 'number' ? +field.value : field.value;
      if (!field.value.trim() || !valid(value)) {
        field.setCustomValidity('Ange en linjetjocklek mellan 0,05 och 5 mm.');
        return;
      }
      field.setCustomValidity('');
      if (!recorded) {
        editor.checkpoint();
        recorded = true;
      }
      item[key] = value;
      historyButtons();
      editor.adapter.redraw();
    };
    field.onblur = () => {
      if (!field.checkValidity()) {
        field.value = item[key] ?? value;
        field.setCustomValidity('');
      }
    };
    bindInspectorField(field, () => item[key] ?? value);
    label.append(field);
    panel.append(label);
    return field;
  };
  const start = panel.children.length;
  input('Linjefärg', 'strokeColor', 'color', style.color, color);
  installLineWeights(
    input(
      'Linjetjocklek · mm',
      'strokeWidth',
      'number',
      style.width,
      (v) => Number.isFinite(v) && v >= 0.05 && v <= 5,
    ),
  );
  const label = document.createElement('label'),
    select = document.createElement('select');
  label.textContent = 'Linjetyp';
  select.append(...Object.entries(shapeLineTypes).map(([v, name]) => new Option(name, v)));
  select.value = style.lineType;
  select.onchange = () => {
    editor.checkpoint();
    item.lineType = select.value;
    historyButtons();
    editor.adapter.redraw();
  };
  label.append(select);
  panel.append(label);
  if (['circle', 'rectangle', 'polygon'].includes(item.shape) || item.closed) {
    const label = document.createElement('label'),
      check = document.createElement('input');
    label.className = 'shape-fill-toggle';
    check.type = 'checkbox';
    check.checked = style.fill !== 'none';
    label.append(check, document.createTextNode('Fyllning'));
    panel.append(label);
    const fill = input(
      'Fyllningsfärg',
      'fillColor',
      'color',
      style.fill === 'none' ? '#dbe8e3' : style.fill,
      color,
    );
    fill.disabled = !check.checked;
    check.onchange = () => {
      editor.checkpoint();
      item.fillColor = check.checked ? fill.value : 'none';
      fill.disabled = !check.checked;
      historyButtons();
      editor.adapter.redraw();
    };
  }
  const fields = [...panel.children].slice(start);
  panel.append(createEditorSection('Utseende', fields));
  installDrawingHatch(editor, item);
  const reset = document.createElement('button');
  reset.textContent = 'Återställ utseende';
  reset.onclick = () => {
    editor.checkpoint();
    for (const key of ['strokeColor', 'strokeWidth', 'lineType', 'fillColor', 'hatch'])
      delete item[key];
    editor.ui();
    editor.adapter.redraw();
  };
  panel.append(reset);
}
import { installLineWeights } from './drawing-line-weights.js';
