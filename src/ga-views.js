import { createEditorSection } from './ui/editor-surface.js';
import { createHtmlGrip } from './ui/grip.js';
import { detailSource, nextDetailLabel } from './drawing-details.js';
import { nextSectionName } from './drawing-sections.js';
import {
  ensureGAViews,
  dependentViewIds,
  duplicateDrawingView,
  resizeDrawingView,
  drawingViewSelection,
} from './drawing-views.js';
import { actionButton } from './drawing-toolbar.js';
import { DrawingViewActions, installDrawingViewDeselection } from './drawing-view-actions.js';
import { drawingProfileDetail } from './profile-detail.js';
import { createDrawingViewInspector } from './drawing-view-inspector.js';
import { viewGripCursor } from './drawing-view-grips.js';
export class GAViews {
  constructor(editor, inspector, toolbar) {
    this.e = editor;
    this.snapshots = new Map();
    this.selectedIds = new Set();
    this.actions = new DrawingViewActions(editor.dialog, {
      views: () => this.items,
      drawingType: () => 'GA',
      annotations: () => editor.annotations.items,
      hit: (event) =>
        event.target.closest('.ga-view-snapshot')?.dataset.gaView ||
        (event.target.closest('.ga-viewport-grip,.ga-crop-grip,.ga-view-grip')
          ? this.active?.id
          : null),
      select: (id) => this.activate(id),
      cancel: () => editor.cancelInteraction(),
      duplicate: () => this.add(true),
      remove: (ids) => this.removeViews(ids),
      changed: (id) => {
        this.load(this.items.find((v) => v.id === id));
        this.refresh();
      },
    });
    editor.annotations.viewActions = this.actions;
    const section = document.createElement('section');
    section.className = 'ga-view-properties';
    section.innerHTML =
      '<label>Markerad vy<select aria-label="Markerad GA-vy"></select></label><label>Namn<input aria-label="GA-vyns namn" maxlength="80"></label><div class="ga-view-actions"></div>';
    inspector.prepend(section);
    this.select = section.querySelector('select');
    this.name = section.querySelector('input');
    this.name.parentElement.after(editor.paperScale.parentElement);
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
      b.dataset.drawingCommandGroup = 'views';
      b.onclick = () => this.add(copy);
      toolbar.insertBefore(b, editor.actionsMenu);
    }
    const remove = document.createElement('button');
    remove.textContent = 'Ta bort vy';
    remove.onclick = () => this.remove();
    section.querySelector('.ga-view-actions').append(remove);
    this.removeButton = remove;
    const identity = createEditorSection('Vy', [
      this.name.parentElement,
      editor.paperScale.parentElement,
      section.querySelector('.ga-view-actions'),
    ]);
    section.append(identity);
    this.placement = createDrawingViewInspector(inspector, {
      selected: () => (this.selected ? this.active : null),
      selectedViews: () => this.selectedViews(),
      move: (dx, dy) => {
        for (const view of this.selectedViews())
          view.position = [view.position[0] + dx, view.position[1] + dy];
        editor.record.sheet.viewPosition = [...this.active.position];
        editor.navigation.size();
        this.position();
      },
      changed: (view, key, axis, value) => {
        if (key === 'position') view.position[axis] = value;
        else
          Object.assign(
            view,
            resizeDrawingView(
              view,
              axis === 0 ? 'e' : 's',
              axis === 0 ? [value - view.size[0], 0] : [0, value - view.size[1]],
            ),
          );
        this.load(view);
        editor.navigation.size();
      },
    });
    for (const corner of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
      const grip = createHtmlGrip({
        role: 'point',
        key: `ga-view:${corner}`,
        label: 'Beskär vyn · skalan behålls',
      });
      grip.classList.add('ga-view-grip', 'ga-view-grip-' + corner);
      grip.dataset.cropCorner = corner;
      grip.style.cursor = viewGripCursor(corner);
      grip.title = 'Beskär vyn · skalan behålls';
      editor.host.append(grip);
    }
    editor.annotations.marquee.bindViews({
      surface: editor.paperWorkspace,
      paper: editor.page,
      paperSize: () => [editor.frameLayout.width, editor.frameLayout.height],
      views: () => this.items,
      changed: () => {
        this.load(this.items.find((v) => v.id === this.active?.id) || this.items[0]);
        this.refresh();
      },
      ids: () => this.selectedIds,
      change: (ids) => {
        this.selectedIds = ids;
        if (ids.size) this.activate([...ids].at(-1), false, true);
        else this.setSelected(false);
      },
      busy: () =>
        !!(
          editor.drag ||
          editor.annotations.mode ||
          editor.annotations.drag ||
          this.actions.pending ||
          editor.sectionTool?.draft ||
          editor.detailTool?.draft
        ),
    });
    installDrawingViewDeselection({
      dialog: editor.dialog,
      surface: editor.paperWorkspace,
      hit: (event) =>
        event.target.closest(
          '.plan-canvas,.ga-view-snapshot,[data-annotation],[data-section-marker],[data-detail-marker]',
        ),
      busy: () =>
        !!(
          editor.drag ||
          editor.annotations.mode ||
          editor.annotations.drag ||
          this.actions.pending ||
          editor.sectionTool?.draft ||
          editor.detailTool?.draft ||
          editor.navigation?.pan.active
        ),
      selected: () => this.selected,
      clear: () => {
        this.setSelected(false);
        editor.draw();
      },
      cancel: () => {
        editor.cancelInteraction();
        editor.draw();
      },
    });
  }
  selectedViews() {
    return this.active ? this.items.filter((view) => this.selectedIds.has(view.id)) : [];
  }
  setSelected(selected) {
    if (!selected) this.selectedIds.clear();
    else if (!this.selectedIds.size && this.active) this.selectedIds.add(this.active.id);
    this.selected = !!this.selectedIds.size;
    this.e.host.classList.toggle('view-unselected', !this.selectedIds.has(this.active?.id));
    for (const [id, snapshot] of this.snapshots) {
      snapshot.classList.toggle('view-selected', this.selectedIds.has(id));
      snapshot.setAttribute('aria-pressed', String(this.selectedIds.has(id)));
    }
    this.list();
    this.placement?.sync();
  }
  get items() {
    return this.e.record?.sheet?.views || [];
  }
  reset() {
    for (const snapshot of this.snapshots.values()) snapshot.remove();
    this.snapshots.clear();
    this.active = null;
    this.selectedIds.clear();
    this.selected = false;
    this.ready = false;
  }
  open() {
    this.selected = true;
    this.e.host.classList.remove('view-unselected');
    const e = this.e;
    ensureGAViews(
      e.record,
      [e.frameLayout.width, e.frameLayout.height],
      e.center.toArray(),
      e.record.sheet.viewScale,
      e.frameLayout.contentArea,
    );
    this.ready = false;
    for (const view of this.items) {
      this.load(view);
      e.rebuild();
      this.snapshot();
    }
    this.load(this.items[0]);
    this.selectedIds = new Set([this.active.id]);
    e.rebuild();
    e.refreshPaper();
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
    e.hatchControl.checked = view.settings.materialHatch !== false;
    view.settings.profileDetail = drawingProfileDetail(view, 'GA');
    e.record.settings.profileDetail = view.settings.profileDetail;
    e.profileDetailControl?.sync(view);
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
    this.placement?.sync();
  }
  list() {
    this.select.replaceChildren(...this.items.map((v) => new Option(v.name, v.id)));
    this.select.value = this.selected ? this.active.id : '';
    this.name.value = this.selected ? this.active.name : '';
    this.name.disabled = !this.selected;
    this.removeButton.disabled = !this.selected || this.items.length < 2;
    this.removeButton.title = this.removeButton.disabled
      ? 'Minst en vy måste finnas kvar på bladet.'
      : '';
    const selected = this.selectedViews();
    const mixed = selected.some((view) => view.scale !== selected[0].scale);
    this.e.paperScale.value = selected.length && !mixed ? selected[0].scale : '';
    this.e.paperScale.placeholder = mixed ? 'Blandade' : '';
    this.e.paperScale.disabled = !selected.length;
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
      if (!child.matches('.ga-viewport-grip,.ga-crop-grip,.ga-view-grip')) {
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
    container.onclick = (event) => this.activate(view.id, event.shiftKey);
    container.onkeydown = (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.activate(view.id, event.shiftKey);
      }
    };
    e.page.insertBefore(container, e.host);
    this.snapshots.set(view.id, container);
    this.position();
  }
  position() {
    const e = this.e;
    this.placement?.sync();
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
    this.setSelected(!!this.selectedIds.size);
    this.e.navigation.size();
  }
  refreshChanged(id) {
    const target = this.items.find((view) => view.id === id);
    if (!target) return;
    if (this.active?.id !== id) {
      this.capture();
      this.snapshot();
    }
    const affected = dependentViewIds(this.items, id);
    for (const view of this.items) {
      if (!affected.has(view.id) || view.id === id) continue;
      this.load(view);
      this.e.rebuild();
      this.snapshot();
    }
    this.load(target);
    this.e.rebuild();
    this.selectedIds = new Set([id]);
    this.setSelected(true);
    this.e.navigation.size();
  }
  activate(id, additive = false, preserve = false) {
    this.selectedIds = drawingViewSelection(this.selectedIds, id, additive, preserve);
    if (!this.selectedIds.size) {
      this.setSelected(false);
      this.e.annotations.selectionScope?.capture();
      return;
    }
    if (!this.selectedIds.has(id)) id = [...this.selectedIds].at(-1);
    if (this.active?.id === id) {
      this.setSelected(true);
      this.e.annotations.selectionScope?.capture();
      return;
    }
    const next = this.items.find((v) => v.id === id);
    if (!next) return;
    const e = this.e;
    clearTimeout(e.pending);
    e.cancelInteraction();
    e.captureSettings();
    e.rebuild();
    this.snapshot();
    this.load(next);
    this.setSelected(true);
    e.rebuild();
    this.list();
    e.navigation.size();
    e.annotations.selectionScope?.capture();
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
