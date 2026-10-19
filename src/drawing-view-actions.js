import { dependentViewIds } from './drawing-views.js';
import { drawingProfileDetail } from './profile-detail.js';

export function alignDrawingView(view, target, direction) {
  const axis = direction === 'horizontal' ? 1 : 0;
  view.position[axis] = target.position[axis] + (target.size[axis] - view.size[axis]) / 2;
}

export class DrawingViewActions {
  constructor(dialog, adapter) {
    this.adapter = adapter;
    this.dialog = dialog;
    dialog.addEventListener(
      'pointerdown',
      (event) => {
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
        if (event.key === 'Escape' && this.pending) {
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
    const hint = this.dialog.querySelector('.annotation-hint');
    if (hint) hint.textContent = 'Redo';
  }
  items(id) {
    const view = this.adapter.views().find((v) => v.id === id);
    if (!view) return [];
    const detail = drawingProfileDetail(view, this.adapter.drawingType?.() || 'SP');
    return [
      { label: 'Duplicera vy', run: () => this.adapter.duplicate(id) },
      {
        label: 'Visning',
        items: [
          {
            label: detail === 'exact' ? 'Visa profiler schematiskt' : 'Visa profiler exakt',
            run: () => {
              view.settings ??= {};
              view.settings.profileDetail = detail === 'exact' ? 'schematic' : 'exact';
              this.adapter.changed(id);
            },
          },
        ],
      },
      { label: 'Rita om vyn', run: () => this.adapter.changed(id) },
      ...[
        ['horizontal', 'Linjera horisontellt…'],
        ['vertical', 'Linjera vertikalt…'],
      ].map(([direction, label]) => ({
        label,
        run: () => {
          this.pending = { id, direction };
          this.dialog.querySelector('.annotation-hint').textContent =
            'Klicka på ramen till referensvyn · Esc avbryter';
        },
      })),
    ];
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
