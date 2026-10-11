import { TEMPLATE_KEYS, dimensionLabel } from './section-templates.js';

import { expression, parameterValues } from './section-profile.js';

export function renderProfileDimensions({ $, def, changeDimension }) {
  const root = $('template-fields'),
    keys = [
      ...new Set([
        ...(TEMPLATE_KEYS[def.template] || []),
        ...(def.radiusParameters || (def.roundedRoots ? ['R'] : [])),
      ]),
    ],
    signature = keys.join(',');
  if (root.dataset.signature !== signature) {
    root.replaceChildren();
    root.dataset.signature = signature;
    for (const key of keys) {
      const label = document.createElement('label');
      label.className = 'field';
      label.textContent = dimensionLabel(key) + ' · mm';
      const input = document.createElement('input');
      input.type = 'number';
      input.step = 'any';
      input.dataset.dimension = key;
      input.id = 'section-dimension-' + key;
      input.oninput = () => {
        changeDimension(key, input.value);
      };
      label.append(input);
      root.append(label);
    }
  }
  for (const input of root.querySelectorAll('input'))
    if (document.activeElement !== input) {
      const p = def.parameters.find((parameter) => parameter.name === input.dataset.dimension);
      try {
        input.value = parameterValues(def.parameters)[p.name];
      } catch {
        input.value = '';
      }
    }
  $('template-note').textContent = keys.length
    ? def.radiusParameters?.length || def.roundedRoots
      ? 'Radier följer profilens parametrar, med segmenterade bågar. Ändrade mått rensar katalogvärdena.'
      : 'Ändra måtten här eller klicka på måtten i ritningen. Typbyte ersätter grundformen; Ångra återställer. Mallarna har skarpa hörn.'
    : 'Fri kontur och valfritt familjenamn. Parametrar kopplas via punktuttryck.';
  if (def.flangeSlope !== undefined)
    $('template-note').textContent += ' Flänslutning ' + def.flangeSlope + ' %.';
}
export function renderProfileBindings({
  vertices: getVertices,
  def,
  $,
  selected,
  fmt,
  selectedParameter,
  resolve,
  selectParameter,
  selectPoint,
}) {
  const vertices = getVertices(),
    names = def.parameters.map((p) => p.name),
    refs = (value) => String(value).match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
  const activeParameter = names.includes(selectedParameter) ? selectedParameter : null;
  const uses = (v, name) => [...refs(v.x), ...refs(v.y)].includes(name);
  const links = $('parameter-links');
  links.replaceChildren();
  for (const name of names) {
    const count = vertices.filter((v) => uses(v, name)).length,
      b = document.createElement('button');
    b.type = 'button';
    b.textContent = `${name} · ${count ? count + ' punkter' : 'ingen punktkoppling'}`;
    b.setAttribute('aria-pressed', String(activeParameter === name));
    b.onclick = () => {
      selectParameter(activeParameter === name ? null : name);
    };
    links.append(b);
  }
  const root = $('bindings');
  root.replaceChildren();
  const linkedPoints = new Set();
  vertices.forEach((v, i) => {
    if (activeParameter && !uses(v, activeParameter)) return;
    if (activeParameter) linkedPoints.add(v.id);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = selected.includes(v.id) ? 'selected' : '';
    const title = document.createElement('strong');
    title.textContent = `P${i + 1}`;
    const expressions = document.createElement('span');
    expressions.textContent = `X: ${v.x}  ·  Y: ${v.y}`;
    const value = document.createElement('small');
    try {
      value.textContent = `→ ${fmt(expression(v.x, resolve))}, ${fmt(expression(v.y, resolve))} mm`;
    } catch {
      value.textContent = 'Ogiltigt uttryck';
    }
    b.append(title, expressions, value);
    b.onclick = () => {
      selectPoint(v.id);
      $('point-panel').open = true;
    };
    root.append(b);
  });
  $('point-hint').textContent =
    selected.length === 1
      ? `P${vertices.findIndex((v) => v.id === selected[0]) + 1} · Ändra uttrycken nedan. Exempel: X = B/2.`
      : vertices.length
        ? 'Välj en punkt här eller på profilen för att ändra dess uttryck.'
        : 'Rita en kontur eller välj en mall för att skapa punktkopplingar.';

  return { activeParameter, linkedPoints };
}
