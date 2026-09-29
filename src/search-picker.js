// A single searchable field shared by the inspector's libraries.
export class SearchPicker {
  constructor(root, { label, placeholder, onSelect }) {
    this.root = root;
    this.onSelect = onSelect;
    this.items = [];
    this.selected = '';
    this.active = 0;
    const id = `picker-${SearchPicker.next++}`;
    root.classList.add('search-picker');
    root.innerHTML = `<input role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}" autocomplete="off"><div class="search-results" id="${id}" role="listbox" hidden></div>`;
    this.input = root.querySelector('input');
    this.input.setAttribute('aria-label', label);
    this.input.placeholder = placeholder;
    this.list = root.querySelector('div');
    this.input.onfocus = () => {
      this.input.select();
      this.show('');
    };
    this.input.onclick = () => {
      if (this.list.hidden) {
        this.input.select();
        this.show('');
      }
    };
    this.input.oninput = () => this.show(this.input.value);
    this.input.onkeydown = (e) => {
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Escape') {
          this.close();
          return;
        }
        if (this.list.hidden) {
          this.show('');
          return;
        }
        if (e.key === 'Enter') {
          if (this.filtered[this.active]) this.choose(this.filtered[this.active]);
          return;
        }
        this.active =
          (this.active + (e.key === 'ArrowDown' ? 1 : -1) + this.filtered.length) %
          Math.max(1, this.filtered.length);
        this.highlight();
      }
    };
    root.addEventListener('focusout', (e) => {
      if (!root.contains(e.relatedTarget)) this.close();
    });
    root.addEventListener('input', (e) => e.stopPropagation());
    root.addEventListener('change', (e) => e.stopPropagation());
  }
  set(items, selected) {
    this.items = items;
    this.selected = selected || '';
    this.input.title = this.items.find((i) => i.label === this.selected)?.detail || this.selected;
    this.close();
  }
  show(query) {
    this.filtered = this.items.filter((i) =>
      `${i.label} ${i.detail || ''}`
        .toLocaleLowerCase('sv')
        .includes(query.trim().toLocaleLowerCase('sv')),
    );
    this.active = 0;
    this.list.replaceChildren();
    for (const [n, item] of this.filtered.entries()) {
      const b = document.createElement('button');
      b.type = 'button';
      b.id = `${this.list.id}-${n}`;
      b.setAttribute('role', 'option');
      const title = document.createElement('span'),
        detail = document.createElement('small');
      title.textContent = item.label;
      detail.textContent = item.detail || '';
      b.append(title, detail);
      b.onmousedown = (e) => e.preventDefault();
      b.onclick = () => this.choose(item);
      this.list.append(b);
    }
    if (!this.filtered.length) {
      const p = document.createElement('p');
      p.textContent = 'Inga träffar';
      this.list.append(p);
    }
    this.list.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
    this.highlight();
  }
  highlight() {
    [...this.list.children].forEach((b, i) =>
      b.setAttribute('aria-selected', String(i === this.active)),
    );
    const b = this.list.children[this.active];
    if (this.filtered.length && b) {
      this.input.setAttribute('aria-activedescendant', b.id);
      b.scrollIntoView({ block: 'nearest' });
    } else this.input.removeAttribute('aria-activedescendant');
  }
  choose(item) {
    this.close();
    this.onSelect(item.value);
  }
  close() {
    this.list.hidden = true;
    this.input.value = this.selected;
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
  }
}
SearchPicker.next = 0;
