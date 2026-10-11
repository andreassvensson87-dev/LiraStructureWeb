import { createPreviewSelect } from './preview-select.js';
import { createEditorSection } from './editor-surface.js';

export function createHatchControl({
  label = 'Hatchning',
  onChange = () => {},
  entries,
  validate,
} = {}) {
  const group = document.createElement('section');
  group.className = 'ui-material-hatch';
  const heading = document.createElement('h3');
  heading.textContent = label;
  const picker = createPreviewSelect({
    label: label + ' · mönster',
    entries,
    onChange: () => {
      sync();
      changed();
    },
  });
  const row = document.createElement('div');
  row.className = 'ui-hatch-fields';
  function field(label, value, min, max, step = 'any') {
    const node = document.createElement('label');
    node.className = 'field';
    node.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.value = value;
    input.min = min;
    input.max = max;
    input.step = step;
    input.required = true;
    input.setAttribute('aria-label', label);
    node.append(input);
    return { node, input };
  }
  const angle = field('Vinkel · °', 45, -360, 360),
    spacing = field('Avstånd · mm', 2.5, 0.5, 100),
    width = field('Linjetjocklek · mm', 0.18, 0.05, 2);
  const pattern = document.createElement('div');
  pattern.className = 'ui-hatch-pattern';
  const caption = document.createElement('span');
  caption.textContent = 'Mönster';
  pattern.append(caption, picker.root);
  row.append(angle.node, spacing.node);
  const advanced = createEditorSection('Avancerat', [width.node], { open: false });
  group.append(heading, pattern, row, advanced);
  for (const { input } of [angle, spacing, width]) input.onchange = changed;
  function get() {
    return {
      pattern: picker.get(),
      angle: Number(angle.input.value),
      spacing: Number(spacing.input.value),
      lineWidth: Number(width.input.value),
    };
  }
  function changed() {
    try {
      for (const { input } of [angle, spacing, width]) if (!input.reportValidity()) return;
      validate(get());
      onChange(get());
    } catch {
      for (const { input } of [angle, spacing, width])
        if (!input.checkValidity()) {
          input.reportValidity();
          break;
        }
    }
  }
  function sync() {
    row.hidden = advanced.hidden = picker.get() === 'none';
  }

  sync();
  return {
    root: group,
    close: () => picker.close(),
    set(h) {
      picker.set(h.pattern);
      angle.input.value = h.angle;
      spacing.input.value = h.spacing;
      width.input.value = h.lineWidth;
      sync();
    },
    get,
  };
}
