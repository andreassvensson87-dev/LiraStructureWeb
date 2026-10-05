import { designation, typeName } from './object-identity.js';
const listingFields = ['id', 'name', 'prefix', 'number', 'type', 'material', 'section'];
export class ModelTree {
  constructor(root, { select, selectGroup, visible, toggle, isolate, showAll }) {
    Object.assign(this, { root, select, selectGroup, visible, toggle, isolate, showAll });
    this.closed = new Set();
    const toolbar = document.createElement('div');
    toolbar.className = 'model-tools';
    toolbar.innerHTML =
      '<input type="search" placeholder="Sök objekt…" aria-label="Sök objekt"><select aria-label="Gruppera modell"><option value="type">Objekttyp</option><option value="material">Material</option><option value="assembly">Assembly</option><option value="none">Ingen gruppering</option></select><div><button type="button">Isolera valda</button><button type="button">Visa alla</button></div>';
    root.before(toolbar);
    this.search = toolbar.querySelector('input');
    this.group = toolbar.querySelector('select');
    this.search.oninput = this.group.onchange = () => this.render(this.objects, this.selected);
    const buttons = toolbar.querySelectorAll('button');
    this.isolateButton = buttons[0];
    buttons[0].onclick = isolate;
    buttons[1].onclick = showAll;
  }
  render(objects = [], selected = new Set(), assemblies = this.assemblies || []) {
    this.objects = objects;
    this.assemblies = assemblies;
    const assemblyListing = JSON.stringify(assemblies);
    const query = this.search.value.toLocaleLowerCase('sv');
    const listing = objects.map((s) => ({
      id: s.id,
      name: s.name,
      prefix: s.prefix,
      number: s.number,
      type: s.type,
      material: s.material?.name,
      section: s.section?.name,
    }));
    // Geometry edits do not change the model list. Retain its DOM, scroll and
    // focus, while still updating selection and externally changed visibility.
    if (
      this.query === query &&
      this.grouping === this.group.value &&
      this.assemblyListing === assemblyListing &&
      this.listing?.length === listing.length &&
      listing.every((s, i) => listingFields.every((key) => s[key] === this.listing[i][key]))
    ) {
      this.setSelection(selected);
      for (const [id, entry] of this.visibilityRows) {
        const shown = this.visible(id);
        if (shown === entry.shown) continue;
        entry.shown = shown;
        entry.eye.textContent = shown ? '◉' : '○';
        entry.eye.setAttribute('aria-label', `${shown ? 'Dölj' : 'Visa'} ${entry.label}`);
        entry.eye.setAttribute('aria-pressed', String(shown));
        entry.row.classList.toggle('muted', !shown);
      }
      return;
    }
    this.listing = listing;
    this.assemblyListing = assemblyListing;
    this.query = query;
    this.grouping = this.group.value;
    this.selected = selected;
    this.isolateButton.disabled = !selected.size;
    this.root.replaceChildren();
    this.rows = new Map();
    this.visibilityRows = new Map();
    this.groupSelections = new Map();
    const byMember = new Map(assemblies.flatMap((a) => a.memberIds.map((id) => [id, a])));
    const objectIds = new Set(objects.map((o) => o.id));
    const matches = objects.filter((s) =>
      `${designation(s)} ${s.name} ${typeName(s)} ${s.material?.name || ''} ${s.section?.name || ''} ${byMember.get(s.id)?.mark || ''} ${byMember.get(s.id)?.name || ''}`
        .toLocaleLowerCase('sv')
        .includes(query),
    );
    const groups = new Map();
    for (const s of matches) {
      const key =
        this.group.value === 'type'
          ? typeName(s)
          : this.group.value === 'material'
            ? s.material?.name || 'Utan material'
            : this.group.value === 'assembly'
              ? byMember.get(s.id)
                ? `${byMember.get(s.id).mark} · ${byMember.get(s.id).name}`
                : 'Utan assembly'
              : '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    }
    for (const [key, list] of groups) {
      let target = this.root;
      if (key) {
        const d = document.createElement('details'),
          summary = document.createElement('summary');
        const groupKey = this.group.value + ':' + key;
        d.open = !this.closed.has(groupKey);
        summary.textContent = `${key} · ${list.length}`;
        if (this.group.value === 'assembly' && byMember.has(list[0].id)) {
          const assembly = byMember.get(list[0].id),
            button = document.createElement('button');
          const ids = assembly.memberIds.filter((id) => objectIds.has(id));
          button.type = 'button';
          button.textContent = 'Markera hela';
          button.setAttribute('aria-label', `Markera assembly ${assembly.mark}`);
          button.classList.toggle(
            'selected',
            ids.length > 0 && ids.every((id) => selected.has(id)),
          );
          button.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.selectGroup?.(ids, event.shiftKey);
          };
          button.setAttribute(
            'aria-pressed',
            String(ids.length > 0 && ids.every((id) => selected.has(id))),
          );
          summary.append(button);
          this.groupSelections.set(assembly.id, { button, ids });
        }
        d.append(summary);
        d.ontoggle = () => (d.open ? this.closed.delete(groupKey) : this.closed.add(groupKey));
        this.root.append(d);
        target = d;
      }
      for (const s of list) {
        const row = document.createElement('div');
        row.className = 'model-row';
        const pick = document.createElement('button');
        pick.type = 'button';
        pick.className = selected.has(s.id) ? 'selected' : '';
        pick.textContent = designation(s);
        pick.title = `${s.name} · ${s.material?.name || 'Utan material'}`;
        pick.onclick = (e) => this.select(s.id, e.shiftKey);
        const eye = document.createElement('button');
        eye.type = 'button';
        const shown = this.visible(s.id);
        eye.textContent = shown ? '◉' : '○';
        eye.setAttribute('aria-label', `${shown ? 'Dölj' : 'Visa'} ${designation(s)}`);
        eye.setAttribute('aria-pressed', String(shown));
        eye.onclick = () => this.toggle(s.id);
        row.classList.toggle('muted', !shown);
        row.append(pick, eye);
        target.append(row);
        this.rows.set(s.id, pick);
        this.visibilityRows.set(s.id, { row, eye, shown, label: designation(s) });
      }
    }
    if (!matches.length) {
      const p = document.createElement('p');
      p.className = 'inspector-note';
      p.textContent = objects.length ? 'Inga träffar.' : 'Inga objekt ännu.';
      this.root.append(p);
    }
  }
  setSelection(selected) {
    this.isolateButton.disabled = !selected.size;
    for (const id of new Set([...(this.selected || []), ...selected])) {
      if (this.selected?.has(id) === selected.has(id)) continue;
      this.rows?.get(id)?.classList.toggle('selected', selected.has(id));
    }
    this.selected = selected;
    for (const { button, ids } of this.groupSelections?.values() || []) {
      button.classList.toggle('selected', ids.length > 0 && ids.every((id) => selected.has(id)));
      button.setAttribute(
        'aria-pressed',
        String(ids.length > 0 && ids.every((id) => selected.has(id))),
      );
    }
  }
}
