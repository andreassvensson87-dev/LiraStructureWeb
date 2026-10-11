import { viewsInRectangle } from './drawing-views.js';
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

/** Tool capture handlers get first refusal; deselection runs only on idle input. */
export function installDrawingViewDeselection({
  dialog,
  surface,
  hit,
  busy,
  selected,
  clear,
  cancel,
}) {
  surface.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.defaultPrevented || busy() || hit(event)) return;
    clear();
  });
  queueMicrotask(() =>
    dialog.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        if (busy()) {
          event.preventDefault();
          event.stopPropagation();
          cancel();
        } else if (selected()) {
          event.preventDefault();
          event.stopPropagation();
          clear();
        }
      },
      true,
    ),
  );
}

/** Shared window/crossing selection on the empty drawing pasteboard. */
export function installDrawingViewMarquee({
  dialog,
  surface,
  paper,
  paperSize,
  views,
  ids,
  change,
  busy,
  hit,
}) {
  const box = document.createElement('div');
  box.className = 'selection-box';
  box.hidden = true;
  surface.append(box);
  let gesture = null;
  const point = (event) => {
    const rect = paper.getBoundingClientRect(),
      size = paperSize();
    return [
      ((event.clientX - rect.left) * size[0]) / rect.width,
      ((event.clientY - rect.top) * size[1]) / rect.height,
    ];
  };
  const cancel = () => {
    const old = gesture;
    gesture = null;
    box.hidden = true;
    if (old && surface.hasPointerCapture(old.id)) surface.releasePointerCapture(old.id);
  };
  surface.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0 || busy() || hit(event) || event.defaultPrevented) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      gesture = {
        id: event.pointerId,
        start: point(event),
        x: event.clientX,
        y: event.clientY,
        ids: new Set(ids()),
        additive: event.shiftKey,
      };
      surface.setPointerCapture(event.pointerId);
    },
    true,
  );
  surface.addEventListener(
    'pointermove',
    (event) => {
      if (!gesture || event.pointerId !== gesture.id) return;
      event.stopImmediatePropagation();
      const rect = surface.getBoundingClientRect();
      box.hidden = false;
      box.classList.toggle('crossing', event.clientX < gesture.x);
      Object.assign(box.style, {
        left: Math.min(event.clientX, gesture.x) - rect.left + surface.scrollLeft + 'px',
        top: Math.min(event.clientY, gesture.y) - rect.top + surface.scrollTop + 'px',
        width: Math.abs(event.clientX - gesture.x) + 'px',
        height: Math.abs(event.clientY - gesture.y) + 'px',
      });
    },
    true,
  );
  surface.addEventListener(
    'pointerup',
    (event) => {
      if (!gesture || event.pointerId !== gesture.id) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const previous = gesture,
        end = point(event);
      const found =
        Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < 4
          ? []
          : viewsInRectangle(views(), previous.start, end);
      cancel();
      change(previous.additive ? new Set([...previous.ids, ...found]) : new Set(found));
    },
    true,
  );
  surface.addEventListener('pointercancel', cancel);
  dialog.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && gesture) {
        event.preventDefault();
        event.stopImmediatePropagation();
        cancel();
      }
    },
    true,
  );
  dialog.addEventListener('close', cancel);
  return {
    cancel,
    get active() {
      return !!gesture;
    },
  };
}
