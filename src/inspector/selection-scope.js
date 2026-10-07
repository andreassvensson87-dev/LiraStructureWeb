import { objectType } from '../model/object-types/index.js';
export class SelectionScope {
  constructor() {
    this.type = '';
    this.signature = '';
  }
  sync(selected) {
    const signature = selected
      .map((s) => s.id)
      .sort()
      .join('|');
    if (signature !== this.signature) {
      this.signature = signature;
      this.type = '';
    }
    if (this.type && !selected.some((s) => objectType(s).id === this.type)) this.type = '';
    return this.objects(selected);
  }
  objects(selected) {
    return this.type ? selected.filter((s) => objectType(s).id === this.type) : selected;
  }
  choose(type, selected) {
    if (type && !selected.some((s) => objectType(s).id === type))
      throw Error('Objekttypen finns inte i markeringen.');
    this.type = type;
    return this.objects(selected);
  }
  groups(selected) {
    const groups = new Map();
    for (const s of selected) {
      const type = objectType(s);
      if (!groups.has(type.id)) groups.set(type.id, { id: type.id, label: type.label, count: 0 });
      groups.get(type.id).count++;
    }
    return [...groups.values()];
  }
}
