import { designation, typeName } from './object-identity.js';
export class ModelTree {
  constructor(root, { select, visible, toggle, isolate, showAll }) {
    Object.assign(this, { root, select, visible, toggle, isolate, showAll });
    this.closed = new Set();
    const toolbar = document.createElement('div');
    toolbar.className = 'model-tools';
    toolbar.innerHTML =
      '<input type="search" placeholder="Sök objekt…" aria-label="Sök objekt"><select aria-label="Gruppera modell"><option value="type">Objekttyp</option><option value="material">Material</option><option value="none">Ingen gruppering</option></select><div><button type="button">Isolera valda</button><button type="button">Visa alla</button></div>';
    root.before(toolbar);
    this.search = toolbar.querySelector('input');
    this.group = toolbar.querySelector('select');
    this.search.oninput = this.group.onchange = () => this.render(this.objects, this.selected);
    const buttons = toolbar.querySelectorAll('button');
    this.isolateButton = buttons[0];
    buttons[0].onclick = isolate;
    buttons[1].onclick = showAll;
  }
  render(objects = [], selected = new Set()) {
    this.objects = objects;
    this.selected = selected;
    this.isolateButton.disabled = !selected.size;
    this.root.replaceChildren();
    this.rows = new Map();
    const query = this.search.value.toLocaleLowerCase('sv');
    const matches = objects.filter((s) =>
      `${designation(s)} ${s.name} ${typeName(s)} ${s.material?.name || ''} ${s.section?.name || ''}`
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
  }
}
