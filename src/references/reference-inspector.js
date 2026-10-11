import { placementAngles } from './reference-placement.js';

export function renderReferenceList({
  $,
  setVisible,
  models,
  folders,
  collapsed,
  showModel,
  toggleFolder,
}) {
  const list = $('[data-list]');
  list.replaceChildren();
  const query = $('[data-search]').value.trim().toLocaleLowerCase('sv');
  const button = (label, text, action, className) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.className = className;
    b.setAttribute('aria-label', label);
    b.onclick = action;
    return b;
  };
  const visibility = (members, label) => {
    const visible = members.some((m) => m.group.visible);
    const b = button(
      `${visible ? 'Dölj' : 'Visa'} ${label}`,
      '',
      () => setVisible(members, !visible),
      'reference-eye',
    );
    b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>${visible ? '' : '<path d="M3 21 21 3"/>'}</svg>`;
    b.setAttribute('aria-pressed', String(visible));
    b.disabled = !members.length;
    return b;
  };
  const all = document.createElement('div');
  all.className = 'reference-list-row reference-all';
  all.append(
    visibility(models, 'alla referenser'),
    document.createTextNode(`Alla (${models.length})`),
  );
  list.append(all);
  for (const folder of folders) {
    const members = models.filter((m) => m.folder === folder);
    const filtered = members.filter((m) =>
      `${m.title} ${m.fileName} ${folder}`.toLocaleLowerCase('sv').includes(query),
    );
    if (query && !filtered.length) continue;
    const section = document.createElement('div');
    const row = document.createElement('div');
    row.className = 'reference-list-row reference-group-row';
    const open = !!query || !collapsed.has(folder);
    const toggle = button(
      `${open ? 'Fäll ihop' : 'Visa grupp'} ${folder}`,
      open ? '▾' : '▸',
      () => {
        toggleFolder(folder);
      },
      'reference-fold',
    );
    toggle.setAttribute('aria-expanded', String(open));
    const name = document.createElement('span');
    name.textContent = `${folder} (${members.length})`;
    row.append(toggle, visibility(members, `gruppen ${folder}`), name);
    section.append(row);
    if (open)
      for (const model of filtered) {
        const r = document.createElement('div');
        r.className = 'reference-list-row reference-model-row';
        r.append(
          visibility([model], model.title),
          button(
            `Öppna ${model.title}`,
            model.title,
            () => showModel(model.id),
            'reference-model-name',
          ),
        );
        section.append(r);
      }
    list.append(section);
  }
  if (query && !list.querySelector('.reference-model-row')) {
    const note = document.createElement('p');
    note.className = 'inspector-note';
    note.textContent = 'Inga träffar';
    list.append(note);
  }
}
export function renderReferencePlacement({ selectedId, $ }, model) {
  if (selectedId !== model.id) return;
  const display = (value) => Math.round(value * 1000) / 1000;
  for (const [axis, key] of ['x', 'y', 'z'].entries())
    $('[data-offset-' + key + ']').value = display(model.placement.offset[axis]);
  const angles = placementAngles(model.placement);
  for (const [i, selector] of [
    '[data-rotation-x]',
    '[data-rotation-y]',
    '[data-cad-rotation]',
  ].entries())
    $(selector).value = display(angles[i]);
}
