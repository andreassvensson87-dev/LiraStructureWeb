import { createEditorSection } from '../ui/editor-surface.js';
import { hasNut } from './library.js';

import { holeExtent } from './placement.js';
import { fastenerPlacementFeedback } from './placement-feedback.js';

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
  placeForm.querySelector('[data-manual-hardware]').hidden = preset;
  for (const input of placeForm.querySelectorAll('[data-accessory-row] input'))
    input.disabled = preset;
  const custom = !preset && f.customAccessories.checked;
  placeForm.querySelector('[data-accessories]').hidden = !custom;
  placeForm.querySelector('[data-start-allowance]').hidden = spec?.kind !== 'rod';
  f.startAllowance.disabled = spec?.kind !== 'rod';
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
    input.dataset.inspectorKey = `accessory-${index}-offset`;
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
  getPartMark = () => '',
  anchor,
  removeHole,
  selectAnchor,
}) {
  const root = placeForm.querySelector('[data-holes]');
  root.replaceChildren();
  const targets = placeForm.querySelector('[data-target-list]');
  targets.replaceChildren();
  placeForm.querySelector('[data-hole-count]').textContent = holeRows.length
    ? `(${holeRows.length})`
    : '';
  placeForm.querySelector('[data-target-empty]').hidden = holeRows.length > 0;
  placeForm.querySelector('[data-hole-tools]').hidden = !holeRows.length;
  holeRows.forEach((h, i) => {
    const part = getObjects().find((s) => s.id === h.targetId);
    const name = part?.name || 'Saknad del';
    const mark = getPartMark(h.targetId);
    const target = document.createElement('div');
    target.className = 'fastener-target-row';
    target.dataset.targetId = h.targetId;
    target.toggleAttribute('data-anchor', h.targetId === anchor);
    target.title = h.targetId === anchor ? 'Referensdel' : name;
    const caption = document.createElement('span');
    caption.textContent = mark ? `${mark} · ${name}` : name;
    const remove = button('×', () => removeHole(i, h.targetId));
    remove.title = `Ta bort ${name} från förbandet`;
    remove.setAttribute('aria-label', remove.title);
    target.append(caption, remove);
    targets.append(target);
    const row = document.createElement('details');
    row.dataset.hole = i;
    row.dataset.boreId = h.id;
    const legend = document.createElement('summary');
    legend.textContent = `${getObjects().find((s) => s.id === h.targetId)?.name || 'Saknad del'}${h.targetId === anchor ? ' · Referensdel' : ''} · ${h.kind === 'none' ? 'Ingen borrning' : `Ø${h.diameter} · ${h.kind === 'pilot' ? 'Förborrning' : 'Genomgående'}`}${h.layers ? ` · ${h.layers.length} lager` : ''}`;
    row.append(legend);
    const fields = document.createElement('div');
    fields.innerHTML = `<label class="field">Håltyp<select name="holeKind"><option value="none">Ingen borrning</option><option value="pilot">Förborrning / blindhål</option><option value="clearance">Frigång / genomgående</option></select></label><label class="field" data-extent>Omfattning<select name="extent"><option value="span">Automatiskt förband</option><option value="wall">Närmaste vägg / fläns</option><option value="profile">Hela profilen</option><option value="blind">Blindhål från ingångsytan</option><option value="manual">Manuellt startläge och djup</option></select></label><details data-hole-dimensions><summary>Hålmått · mm</summary><div class="coordinates">${numeric('offset', 'Start · mm', h.offset, -1e7)}${numeric('diameter', 'Diameter · mm', h.diameter, 0.001)}${numeric('depth', 'Djup · mm', h.depth, 0.001)}</div><details><summary>Försänkning</summary><div class="dimensions">${numeric('csDiameter', 'Diameter · mm (0 = av)', h.countersink?.diameter || 0)}${numeric('csDepth', 'Djup · mm', h.countersink?.depth || 0)}</div></details></details>`;
    for (const control of fields.querySelectorAll('input,select'))
      control.dataset.inspectorKey = `${h.targetId}-${control.name}`;
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

/** Present the already-resolved batch in both the compact list and the optional hole details. */
export function renderFastenerPlacementFeedback(placeForm, batch, objects) {
  const output = placeForm.querySelector('[data-placement-feedback]');
  if (!batch?.length) {
    output.textContent = '';
    output.removeAttribute('data-status');
    for (const row of placeForm.querySelectorAll('[data-target-id]')) {
      delete row.dataset.reached;
      row.querySelector('span').removeAttribute('title');
    }
    return;
  }
  const feedback = fastenerPlacementFeedback(batch);
  const range = ({ min, max }) => (min === max ? String(min) : `${min}–${max}`);
  const ready =
    !feedback.warnings.length &&
    feedback.layers.min > 0 &&
    feedback.targets.every(
      (t) =>
        t.reached === batch.length ||
        batch[0].holes.find((h) => h.targetId === t.id)?.kind === 'none',
    );
  output.dataset.status = ready ? 'ready' : 'warning';
  output.textContent = `${ready ? '✓ ' : ''}${feedback.count} ${feedback.count === 1 ? 'skruv' : 'skruvar'} · ${range(feedback.layers)} lager`;
  output.title =
    feedback.warnings.join(' ') || (ready ? '' : 'Alla valda delar träffas inte av skruvarna.');
  placeForm.querySelector('[data-hole-overview]').textContent =
    `${feedback.targets.filter((t) => t.reached).length}/${feedback.targets.length} delar`;
  const names = new Map(objects.map((o) => [o.id, o.name || 'Del']));
  for (const [i, hole] of batch[0].holes.entries()) {
    const info = feedback.targets.find((t) => t.id === hole.targetId);
    const row = [...placeForm.querySelectorAll('[data-target-id]')].find(
      (r) => r.dataset.targetId === hole.targetId,
    );
    if (row) {
      row.dataset.reached =
        hole.kind === 'none' ? 'none' : info.reached === batch.length ? 'all' : 'partial';
      row.querySelector('span').title =
        hole.kind === 'none'
          ? 'Inga hål'
          : `${info.reached}/${batch.length} skruvar · ${range(info)} lager`;
    }
    const summary = placeForm.querySelector(`[data-hole="${i}"] > summary`);
    if (summary)
      summary.textContent = `${names.get(hole.targetId) || 'Del'} · ${hole.kind === 'none' ? 'Inga hål' : `Ø${hole.diameter} · ${range(info)} lager`}`;
  }
}

/** Adopt existing metadata controls; their owners, IDs and events stay unchanged. */
export function createFastenerMetadata(inspector, panel) {
  const section = createEditorSection('Objekt', [], { open: false });
  section.classList.add('attribute-section');
  let homes = [];
  return {
    show() {
      if (homes.length) {
        for (const { node } of homes) if (node.parentElement !== section) section.append(node);
        if (section.parentElement !== panel) panel.append(section);
        return;
      }
      const nodes = [
        inspector.querySelector('#inspector-identity'),
        inspector.querySelector('#inspector-ifc-class')?.closest('label'),
        inspector.querySelector('#sweep-identity-details'),
        inspector.querySelector('.material-quick-row'),
      ].filter(Boolean);
      homes = nodes.map((node) => {
        const marker = document.createComment('fastener-metadata-home');
        node.before(marker);
        section.append(node);
        return { node, marker };
      });
      panel.append(section);
    },
    restore() {
      for (const { node, marker } of homes) {
        marker.replaceWith(node);
      }
      homes = [];
      section.remove();
    },
  };
}
