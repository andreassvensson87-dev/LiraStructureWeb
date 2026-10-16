import { createAttributeRow } from '../inspector/attributes.js';
import { commandIcon } from '../ui/icons.js';

const standardKey = (s) => JSON.stringify([s.kind, s.standard || s.series || s.name]);
const identity = (s) => `${s.id}:${s.revision}`;
/** Library-backed cascading fields: no invented sizes, grades or coatings. */
export function createFastenerProductPicker(form, { openLibrary, changed }) {
  const host = form.querySelector('[data-product-picker]');
  const controls = {};
  const keys = ['standard', 'diameter', 'grade', 'coating'];
  const get = (spec, key) => (key === 'standard' ? standardKey(spec) : String(spec[key] ?? ''));
  const caption = (spec, key) =>
    key === 'standard'
      ? spec.standard || spec.series || spec.name
      : key === 'diameter'
        ? `${spec.kind === 'bolt' || spec.kind === 'rod' ? 'M' : 'Ø'}${spec.diameter}`
        : spec[key] || '—';
  const grid = document.createElement('div');
  grid.className = 'fastener-product-grid attribute-columns';
  for (const [key, label] of [
    ['standard', 'Standard'],
    ['diameter', 'Dimension'],
    ['grade', 'Klass'],
    ['coating', 'Yta'],
  ]) {
    const row = createAttributeRow({ key: `product-${key}`, label, type: 'select' });
    controls[key] = row.querySelector('select');
    grid.append(row);
  }
  const library = document.createElement('button');
  library.type = 'button';
  library.title = 'Öppna skruvbibliotek';
  library.setAttribute('aria-label', library.title);
  library.append(commandIcon('library'));
  library.onclick = openLibrary;
  grid.querySelector('label').append(library);
  host.append(grid);
  let records = [],
    selected = null;
  const length = form.elements.manualLength;
  function render() {
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const candidates = records.filter(
        (s) => !selected || keys.slice(0, i).every((k) => get(s, k) === get(selected, k)),
      );
      const values = new Map(candidates.map((s) => [get(s, key), caption(s, key)]));
      controls[key].replaceChildren(
        ...[...values].map(([value, label]) => new Option(label, value)),
      );
      controls[key].disabled = !records.length;
      if (selected) controls[key].value = get(selected, key);
    }
    if (!length.value && selected) length.value = selected.length;
    length.disabled = !selected;
    host.dataset.empty = String(!records.length);
  }
  for (const [index, key] of keys.entries())
    controls[key].onchange = () => {
      const candidates = records.filter((s) =>
        keys.slice(0, index + 1).every((k) => get(s, k) === controls[k].value),
      );
      const preferred = candidates.filter((s) =>
        keys.slice(index + 1).every((k) => !selected || get(s, k) === get(selected, k)),
      );
      selected =
        (preferred.length ? preferred : candidates).sort(
          (a, b) =>
            Math.abs(a.length - (selected?.length || 0)) -
            Math.abs(b.length - (selected?.length || 0)),
        )[0] || null;
      form.elements.spec.value = selected ? identity(selected) : '';
      render();
      changed();
    };
  return {
    set(next, spec) {
      records = [...next];
      selected = spec;
      render();
    },
  };
}
