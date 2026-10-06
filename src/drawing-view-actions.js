export function dependentViewIds(views, id) {
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const view of views)
      if (ids.has(view.source?.parentViewId) && !ids.has(view.id)) {
        ids.add(view.id);
        changed = true;
      }
  }
  return ids;
}

import { drawingProfileDetail } from './profile-detail.js';

export function alignDrawingView(view, target, direction) {
  const axis = direction === 'horizontal' ? 1 : 0;
  view.position[axis] = target.position[axis] + (target.size[axis] - view.size[axis]) / 2;
}

export class DrawingViewActions {
  constructor(dialog, adapter) {
    this.adapter = adapter;
    this.dialog = dialog;
    this.menu = document.createElement('div');
    this.menu.className = 'annotation-context-menu';
    this.menu.hidden = true;
    dialog.append(this.menu);
    dialog.addEventListener(
      'contextmenu',
      (event) => {
        const id = adapter.hit(event);
        if (!id) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        adapter.cancel();
        this.cancel();
        adapter.select(id);
        this.open(id, event);
      },
      true,
    );
    dialog.addEventListener(
      'pointerdown',
      (event) => {
        if (this.menu.contains(event.target)) return;
        this.menu.hidden = true;
        if (!this.pending || event.button !== 0) return;
        const target = adapter.views().find((v) => v.id === adapter.hit(event));
        if (!target) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const source = adapter.views().find((v) => v.id === this.pending.id);
        if (!source || source.id === target.id) return;
        alignDrawingView(source, target, this.pending.direction);
        this.cancel();
        adapter.changed(source.id);
        this.consumeUp = true;
      },
      true,
    );
    dialog.addEventListener(
      'pointerup',
      (event) => {
        if (!this.consumeUp || event.button !== 0) return;
        this.consumeUp = false;
        event.preventDefault();
        event.stopImmediatePropagation();
      },
      true,
    );
    dialog.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape' && (this.pending || !this.menu.hidden)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.cancel();
        }
      },
      true,
    );
    dialog.addEventListener('close', () => this.cancel());
  }
  cancel() {
    this.pending = null;
    this.menu.hidden = true;
    const hint = this.dialog.querySelector('.annotation-hint');
    if (hint) hint.textContent = 'Redo';
  }
  open(id, event) {
    this.menu.replaceChildren();
    const button = (label, action) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.onclick = () => {
        this.menu.hidden = true;
        action();
      };
      this.menu.append(b);
    };
    button('Duplicera vy', () => this.adapter.duplicate(id));
    const view = this.adapter.views().find((v) => v.id === id);
    const detail = drawingProfileDetail(view, this.adapter.drawingType?.() || 'SP');
    button(detail === 'exact' ? 'Visa profiler schematiskt' : 'Visa profiler exakt', () => {
      view.settings ??= {};
      view.settings.profileDetail = detail === 'exact' ? 'schematic' : 'exact';
      this.adapter.changed(id);
    });
    button('Rita om vyn', () => this.adapter.changed(id));
    button('Ta bort vy…', () => this.remove(id));
    for (const [direction, label] of [
      ['horizontal', 'Linjera horisontellt…'],
      ['vertical', 'Linjera vertikalt…'],
    ])
      button(label, () => {
        this.pending = { id, direction };
        this.dialog.querySelector('.annotation-hint').textContent =
          'Klicka på ramen till referensvyn · Esc avbryter';
      });
    this.menu.hidden = false;
    const box = this.dialog.getBoundingClientRect();
    this.menu.style.left = Math.max(0, Math.min(event.clientX - box.left, box.width - 230)) + 'px';
    this.menu.style.top =
      Math.max(0, Math.min(event.clientY - box.top, box.height - this.menu.offsetHeight)) + 'px';
    this.menu.querySelector('button').focus();
  }
  remove(id) {
    const views = this.adapter.views(),
      ids = dependentViewIds(views, id);
    if (ids.size >= views.length) {
      this.dialog.querySelector('.annotation-hint').textContent =
        'Minst en vy måste finnas kvar. Vyn kan inte tas bort tillsammans med alla sina beroende vyer.';
      return;
    }
    const annotations = this.adapter.annotations().filter((a) => ids.has(a.view));
    const names = views
      .filter((v) => ids.has(v.id))
      .map((v) => v.name)
      .join(', ');
    if (
      !confirm(
        `Ta bort ${names}?\n\n${ids.size} vy(er), inklusive beroende sektioner och detaljer, samt ${annotations.length} mått/part marks tas bort. Hänvisningar till de borttagna vyerna försvinner också.`,
      )
    )
      return;
    this.adapter.remove(ids);
  }
}
