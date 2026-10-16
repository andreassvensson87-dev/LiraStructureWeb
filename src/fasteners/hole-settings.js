import { createAttributeRow } from '../inspector/attributes.js';

/** Compact shared hole fields; per-part overrides remain in the existing disclosures. */
export function createHoleSettings(root, changed) {
  const controls = {};
  root.className = 'attribute-columns';
  for (const [key, label, type, options] of [
    [
      'kind',
      'Håltyp',
      'select',
      [
        ['', 'Blandat'],
        ['clearance', 'Genomgående'],
        ['pilot', 'Blindhål'],
        ['none', 'Inga hål'],
      ],
    ],
    ['clearance', 'Spel', 'number'],
    ['depth', 'Djup', 'number'],
  ]) {
    const row = createAttributeRow({ key: `hole-${key}`, label, type, options, step: 'any' });
    const control = row.querySelector('input,select');
    controls[key] = control;
    control.addEventListener(type === 'number' ? 'input' : 'change', (event) => {
      event.stopPropagation();
      if (control.value === '') return;
      changed(key, type === 'number' ? Number(control.value) : control.value);
    });
    root.append(row);
  }
  return {
    sync(holes, spec) {
      const common = (values) =>
        values.length && values.every((v) => v === values[0]) ? values[0] : '';
      controls.kind.value = common(holes.map((h) => h.kind));
      controls.clearance.value = spec
        ? common(holes.map((h) => Math.round((h.diameter - spec.diameter) * 1e6) / 1e6))
        : '';
      controls.depth.value = common(holes.map((h) => h.depth));
      controls.depth.parentElement.hidden = controls.kind.value !== 'pilot';
      controls.clearance.disabled = !holes.length || controls.kind.value === 'none';
      controls.kind.disabled = !holes.length;
      controls.clearance.placeholder = 'Blandat';
    },
  };
}
