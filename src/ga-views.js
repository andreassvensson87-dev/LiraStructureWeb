import { detailSource, nextDetailLabel } from './drawing-details.js';
import { nextSectionName } from './drawing-sections.js';
import { ensureGAViews, duplicateDrawingView, resizeDrawingView } from './drawing-views.js';
import { actionButton } from './drawing-toolbar.js';
import { DrawingViewActions } from './drawing-view-actions.js';
export class GAViews {
  constructor(editor, inspector, toolbar) {
    this.e = editor;
    this.snapshots = new Map();
    this.actions = new DrawingViewActions(editor.dialog, {
      views: () => this.items,
      annotations: () => editor.annotations.items,
      hit: (event) =>
        event.target.closest('.ga-view-snapshot')?.dataset.gaView ||
        (event.target.closest('.ga-viewport-grip,.ga-crop-grip') ? this.active?.id : null),
      select: (id) => this.activate(id),
      cancel: () => editor.cancelInteraction(),
      duplicate: () => this.add(true),
      remove: (ids) => this.removeViews(ids),
      changed: (id) => {
        this.load(this.items.find((v) => v.id === id));
        this.refresh();
      },
    });
    const section = document.createElement('section');
    section.className = 'ga-view-properties';
    section.innerHTML =
      '<h3>Vyer</h3><label>Markerad vy<select aria-label="Markerad GA-vy"></select></label><label>Namn<input aria-label="GA-vyns namn" maxlength="80"></label><div class="ga-view-actions"></div>';
    inspector.prepend(section);
    this.select = section.querySelector('select');
    this.name = section.querySelector('input');
    this.select.onchange = () => this.activate(this.select.value);
    this.name.oninput = () => {
      this.active.name = this.name.value.trim() || 'Planvy';
      const option = this.select.selectedOptions[0];
      if (option) option.textContent = this.active.name;
    };
    this.name.onchange = () => {
      this.list();
      this.e.draw();
    };
    for (const [label, copy] of [
      ['Ny vy', false],
      ['Duplicera vy', true],
    ]) {
      const b = actionButton(document.createElement('button'), copy ? 'layout' : 'plus', label);
      b.onclick = () => this.add(copy);
      toolbar.insertBefore(b, editor.actionsMenu);
    }
    const remove = document.createElement('button');
    remove.textContent = 'Ta bort vy';
    remove.onclick = () => this.remove();
    section.querySelector('.ga-view-actions').append(remove);
    this.removeButton = remove;
    for (const corner of ['nw', 'ne', 'se', 'sw']) {
      const grip = document.createElement('div');
      grip.className = 'ga-crop-grip ga-crop-' + corner;
      grip.dataset.cropCorner = corner;
      grip.title = 'Dra för att beskära vyn · skalan behålls';
      editor.host.append(grip);
    }
  }
  get items() {
    return this.e.record.sheet.views;
  }
  reset() {
    for (const snapshot of this.snapshots.values()) snapshot.remove();
    this.snapshots.clear();
    this.active = null;
  }
  open() {
    const e = this.e;
    ensureGAViews(
      e.record,
      [e.frameLayout.width, e.frameLayout.height],
      e.center.toArray(),
      e.record.sheet.viewScale,
    );
    this.ready = false;
    for (const view of this.items) {
      this.load(view);
      e.rebuild();
      this.snapshot();
    }
    this.load(this.items[0]);
    e.rebuild();
    this.ready = true;
    this.list();
    e.navigation.fit();
  }
  capture() {
    if (!this.active) return;
    const e = this.e;
    this.active.camera.center = e.center.toArray();
    this.active.settings = { ...e.record.settings, levelId: e.record.levelId };
    this.active.scale = e.record.sheet.viewScale;
    this.active.position = [...e.record.sheet.viewPosition];
  }
  load(view) {
    const e = this.e,
      source = detailSource(view, this.items);
    if (view.detail)
      for (const key of ['levelId', 'lower', 'cut', 'upper'])
        view.settings[key] = source.settings[key];
    this.active = view;
    e.selectedParts.clear();
    e.markSelected.disabled = true;
    e.record.settings = { ...view.settings };
    e.record.levelId = view.settings.levelId;
    e.record.sheet.viewPosition = [...view.position];
    e.record.sheet.viewScale = view.scale;
    e.center.fromArray(view.camera.center);
    e.span = view.size[1] * view.scale;
    e.$('level').value = view.settings.levelId;
    for (const k of ['lower', 'cut', 'upper']) e.$(k).value = view.settings[k];
    e.$('hidden-lines').checked = !!view.settings.hiddenLines;
    e.paperScale.value = view.scale;
    e.$('section-grid').parentElement.hidden = !source.section;
    e.$('section-grid').checked = view.settings.showGrid !== false;
    e.$('section-levels').parentElement.hidden = !source.section;
    e.$('section-levels').checked = view.settings.showLevels !== false;
    for (const key of ['level', 'lower', 'cut', 'upper'])
      e.$(key).parentElement.hidden = !!source.section || !!view.detail;
    this.snapshots.get(view.id)?.remove();
    this.snapshots.delete(view.id);
    e.positionView();
  }
  list() {
    this.select.replaceChildren(...this.items.map((v) => new Option(v.name, v.id)));
    this.select.value = this.active.id;
    this.name.value = this.active.name;
    this.removeButton.disabled = this.items.length < 2;
    this.removeButton.title = this.removeButton.disabled
      ? 'Minst en vy måste finnas kvar på bladet.'
      : '';
    this.e.sectionTool?.sync();
  }
  snapshot() {
    const e = this.e;
    if (!this.active || !e.scene) return;
    this.snapshots.get(this.active.id)?.remove();
    const view = this.active,
      container = document.createElement('div');
    container.className = 'ga-view-snapshot';
    container.dataset.gaView = view.id;
    container.setAttribute('role', 'button');
    container.tabIndex = 0;
    container.setAttribute('aria-label', 'Välj vy ' + view.name);
    const content = document.createElement('div');
    content.className = 'ga-snapshot-content';
    container.append(content);
    for (const child of e.host.children)
      if (!child.matches('.ga-viewport-grip,.ga-crop-grip')) {
        const clone = child.cloneNode(true);
        clone
          .querySelectorAll('.section-extent-guides,[data-section-endpoint],[data-detail-corner]')
          .forEach((n) => n.remove());
        if (clone.tagName.toLowerCase() === 'svg') {
          const clip = clone.querySelector('clipPath');
          if (clip) {
            const clipId = 'ga-crop-' + view.id;
            clip.id = clipId;
            clone.querySelector('[clip-path]')?.setAttribute('clip-path', `url(#${clipId})`);
          }
        }
        content.append(clone);
      }
    container.dataset.zoom = e.paperZoom;
    content.style.width = e.host.clientWidth + 'px';
    content.style.height = e.host.clientHeight + 'px';
    container.onclick = () => this.activate(view.id);
    container.onkeydown = (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.activate(view.id);
      }
    };
    e.page.insertBefore(container, e.host);
    this.snapshots.set(view.id, container);
    this.position();
  }
  position() {
    const e = this.e;
    for (const view of this.items || []) {
      const snapshot = this.snapshots.get(view.id);
      if (!snapshot) continue;
      Object.assign(snapshot.style, {
        left: view.position[0] * e.paperZoom + 'px',
        top: view.position[1] * e.paperZoom + 'px',
        width: view.size[0] * e.paperZoom + 'px',
        height: view.size[1] * e.paperZoom + 'px',
      });
      snapshot.firstChild.style.transform = `scale(${e.paperZoom / Number(snapshot.dataset.zoom)})`;
    }
  }
  refresh() {
    const id = this.active.id;
    this.e.captureSettings();
    for (const view of this.items) {
      this.load(view);
      this.e.rebuild();
      if (view.id !== id) this.snapshot();
    }
    this.load(this.items.find((v) => v.id === id));
    this.e.rebuild();
    this.list();
    this.e.navigation.size();
  }
  activate(id) {
    if (this.active?.id === id) return;
    const next = this.items.find((v) => v.id === id);
    if (!next) return;
    const e = this.e;
    clearTimeout(e.pending);
    e.cancelInteraction();
    e.captureSettings();
    e.rebuild();
    this.snapshot();
    this.load(next);
    e.rebuild();
    this.list();
    e.navigation.size();
  }
  add(copy) {
    const e = this.e;
    clearTimeout(e.pending);
    e.captureSettings();
    const result = duplicateDrawingView(this.active, this.items, e.annotations.items, {
      copyAnnotations: copy,
    });
    if (!copy) {
      delete result.view.section;
      delete result.view.detail;
      result.view.projection = 'plan';
      result.view.camera.center = [0, 0];
      result.view.name = 'Planvy ' + (this.items.length + 1);
      result.view.source = { type: 'model' };
      result.view.kind = 'view';
    }
    if (copy && result.view.section) {
      const label = nextSectionName(e.references.namingViews());
      result.view.section.label = label;
      result.view.name = `Snitt ${label}–${label}`;
    }
    if (copy && result.view.detail) {
      const label = nextDetailLabel(e.references.namingViews());
      result.view.detail.label = label;
      result.view.name = `Detalj ${label}`;
    }
    this.items.push(result.view);
    e.annotations.items.push(...result.annotations);
    this.activate(result.view.id);
  }
  remove() {
    this.actions.remove(this.active.id);
  }
  removeViews(ids) {
    const e = this.e,
      next = this.items.find((v) => !ids.has(v.id));
    this.activate(next.id);
    e.record.sheet.views = this.items.filter((v) => !ids.has(v.id));
    e.annotations.items = e.record.annotations = e.annotations.items.filter(
      (a) => !ids.has(a.view),
    );
    e.annotations.history = [];
    e.annotations.future = [];
    for (const id of ids) {
      this.snapshots.get(id)?.remove();
      this.snapshots.delete(id);
    }
    this.list();
    this.refresh();
    e.navigation.size();
  }
  startDrag(event) {
    const crop = event.target.closest('[data-crop-corner]');
    return crop ? { corner: crop.dataset.cropCorner, view: structuredClone(this.active) } : null;
  }
  crop(drag, dx, dy) {
    const next = resizeDrawingView(drag.view, drag.corner, [dx, dy]);
    Object.assign(this.active, next);
    this.load(this.active);
  }
}
