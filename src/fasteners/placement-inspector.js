import { hasNut } from './library.js';

import { holeExtent } from './placement.js';

const numeric = (name, label, value, min = 0) =>
  `<label class="field">${label}<input name="${name}" type="number" step="any" min="${min}" value="${value}" required></label>`;
const button = (text, action) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.onclick = action;
  return b;
};
export function renderFastenerAccessories({
  currentSpec,
  placeForm,
  accessoryRows,
  removeAccessory,
}) {
  const spec = currentSpec();
  const f = placeForm.elements;
  if (spec?.kind === 'rod') f.customAccessories.checked = true;
  f.customAccessories.disabled = !spec || spec.kind === 'rod';
  const preset = f.assemblyMode.value === 'preset';
  placeForm.querySelector('[data-assembly-picker]').hidden = !preset;
  placeForm.querySelector('[data-assembly-hint]').hidden = !preset;
  placeForm.querySelector('[data-manual-hardware]').hidden = preset;
  if (spec?.kind !== 'bolt') f.lengthMode.value = 'manual';
  f.lengthMode.disabled = spec?.kind !== 'bolt';
  const auto = f.lengthMode.value === 'auto';
  placeForm.querySelector('[data-extra-length]').hidden = !auto;
  f.extraLength.disabled = !auto;
  for (const input of placeForm.querySelectorAll('[data-accessory-row] input'))
    input.disabled = preset;
  const custom = !preset && f.customAccessories.checked;
  placeForm.querySelector('[data-accessories]').hidden = !custom;
  placeForm.querySelector('[data-start-allowance]').hidden = spec?.kind !== 'rod';
  f.startAllowance.disabled = spec?.kind !== 'rod' || preset;
  placeForm.querySelector('[data-washers]').hidden = custom || !spec?.washer;
  placeForm.querySelector('[data-add-nut]').disabled = !hasNut(spec);
  placeForm.querySelector('[data-add-washer]').disabled = !spec?.washer;
  const root = placeForm.querySelector('[data-accessory-rows]');
  root.replaceChildren();
  (accessoryRows || []).forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'fastener-accessory-row';
    row.dataset.accessoryRow = item.kind;
    const label = document.createElement('label');
    label.className = 'field';
    label.textContent = `${item.kind === 'nut' ? 'Mutter' : 'Bricka'} ${index + 1} · läge (mm)`;
    const input = document.createElement('input');
    input.type = 'number';
    input.required = true;
    input.disabled = !custom;
    input.min = '0';
    input.step = 'any';
    input.value = item.offset;
    input.setAttribute('aria-label', label.textContent);
    label.append(input);
    row.append(
      label,
      button('Ta bort', () => {
        removeAccessory(index);
      }),
    );
    root.append(row);
  });
}
export function renderFastenerHoles({
  placeForm,
  holeRows,
  getObjects,
  anchor,
  removeHole,
  selectAnchor,
}) {
  const root = placeForm.querySelector('[data-holes]');
  root.replaceChildren();
  placeForm.querySelector('[data-hole-count]').textContent = holeRows.length
    ? `(${holeRows.length})`
    : '';
  placeForm.querySelector('[data-target-empty]').hidden = holeRows.length > 0;
  placeForm.querySelector('[data-hole-tools]').hidden = !holeRows.length;
  holeRows.forEach((h, i) => {
    const row = document.createElement('details');
    row.dataset.hole = i;
    row.dataset.boreId = h.id;
    const legend = document.createElement('summary');
    legend.textContent = `${getObjects().find((s) => s.id === h.targetId)?.name || 'Saknad del'} · ${h.kind === 'none' ? 'Ingen borrning' : `Ø${h.diameter} · ${h.kind === 'pilot' ? 'Förborrning' : 'Genomgående'}`}${h.layers ? ` · ${h.layers.length} lager` : ''}`;
    row.append(legend);
    const fields = document.createElement('div');
    fields.innerHTML = `<label class="field">Håltyp<select name="holeKind"><option value="none">Ingen borrning</option><option value="pilot">Förborrning / blindhål</option><option value="clearance">Frigång / genomgående</option></select></label><label class="field" data-extent>Omfattning<select name="extent"><option value="span">Automatiskt förband</option><option value="wall">Närmaste vägg / fläns</option><option value="profile">Hela profilen</option><option value="blind">Blindhål från ingångsytan</option><option value="manual">Manuellt startläge och djup</option></select></label><details data-hole-dimensions><summary>Hålmått · mm</summary><p class="inspector-note">Automatiska lägen beräknas vid placering och sparande. Välj manuellt för egna start- och djupmått.</p><div class="coordinates">${numeric('offset', 'Start · mm', h.offset, -1e7)}${numeric('diameter', 'Diameter · mm', h.diameter, 0.001)}${numeric('depth', 'Djup · mm', h.depth, 0.001)}</div><details><summary>Försänkning</summary><div class="dimensions">${numeric('csDiameter', 'Diameter · mm (0 = av)', h.countersink?.diameter || 0)}${numeric('csDepth', 'Djup · mm', h.countersink?.depth || 0)}</div></details></details>`;
    const kind = fields.querySelector('[name=holeKind]');
    kind.value = h.kind;
    const extent = fields.querySelector('[name=extent]');
    extent.value = holeExtent(h);
    const syncDimensions = () => {
      fields.querySelector('[data-extent]').hidden = kind.value === 'none';
      fields.querySelector('[name=offset]').readOnly = extent.value !== 'manual';
      fields.querySelector('[name=depth]').readOnly = !['blind', 'manual'].includes(extent.value);
      fields.querySelector('[data-hole-dimensions]').hidden = kind.value === 'none';
      fields.querySelectorAll('input').forEach((input) => (input.disabled = kind.value === 'none'));
    };
    kind.onchange = () => {
      extent.value = kind.value === 'pilot' ? 'blind' : 'profile';
      syncDimensions();
    };
    extent.onchange = () => {
      if (extent.value === 'blind') kind.value = 'pilot';
      else if (extent.value !== 'manual') kind.value = 'clearance';
      syncDimensions();
    };
    syncDimensions();
    row.append(
      fields,
      button('Ta bort delkoppling', () => {
        removeHole(i, h.targetId);
      }),
    );
    root.append(row);
  });
  const select = placeForm.elements.anchor;
  select.replaceChildren(new Option('Fristående', ''));
  holeRows.forEach((h) =>
    select.append(
      new Option(getObjects().find((s) => s.id === h.targetId)?.name || h.targetId, h.targetId),
    ),
  );
  select.value = anchor;
  select.onchange = () => selectAnchor(select.value);
}
