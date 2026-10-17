import { bindInspectorField } from './inspector/field-state.js';
import { installInsulationInspector } from './drawing-insulation-inspector.js';
import { createEditorSection } from './ui/editor-surface.js';
import { createHatchControl } from './hatch-control.js';
import { validateShape } from './drawing-shapes.js';

export function installDrawingOrder(editor, item, source = item) {
  const label = document.createElement('label'),
    select = document.createElement('select');
  label.textContent = 'Placering';
  select.append(new Option('Framför modellen', 'front'), new Option('Bakom modellen', 'back'));
  select.value = item.drawOrder === 'back' ? 'back' : 'front';
  select.onchange = () => {
    if (editor.items?.includes(item)) editor.checkpoint();
    item.drawOrder = select.value;
    editor.ui();
    editor.adapter.redraw();
  };
  bindInspectorField(select, () => (source.drawOrder === 'back' ? 'back' : 'front'));
  label.append(select);
  editor.panel.append(createEditorSection('Ritordning', [label]));
}

export function installDrawingGeometry(editor, item) {
  installInsulationInspector(editor, item);
  if (!['polyline', 'polygon'].includes(item.shape)) return;
  const label = document.createElement('label'),
    check = document.createElement('input');
  label.className = 'shape-fill-toggle';
  check.type = 'checkbox';
  check.checked = item.closed || item.shape === 'polygon';
  label.append(check, 'Sluten');
  const count = document.createElement('p');
  count.textContent = `${item.points.length} hörnpunkter`;
  check.onchange = () => {
    try {
      validateShape('polyline', item.points, check.checked);
      editor.checkpoint();
      item.closed = check.checked;
      item.shape = check.checked ? 'polygon' : 'polyline';
      editor.ui();
      editor.adapter.redraw();
    } catch (error) {
      check.checked = !!item.closed;
      editor.hint.textContent = error.message;
    }
  };
  editor.panel.append(createEditorSection('Geometri', [label, count]));
}

export function installDrawingHatch(editor, item) {
  if (!['circle', 'rectangle', 'polygon'].includes(item.shape) && !item.closed) return;
  const control = createHatchControl({
    label: 'Hatchning',
    onChange: (value) => {
      editor.checkpoint();
      item.hatch = value;
      editor.adapter.redraw();
    },
  });
  control.set(item.hatch || { pattern: 'none', angle: 45, spacing: 2.5, lineWidth: 0.18 });
  editor.panel.append(control.root);
}
