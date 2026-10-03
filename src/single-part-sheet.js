import { createSinglePartShell } from './drawing/ui/single-part-shell.js';
import { instantiateDrawingTemplate } from './drawing-templates.js';
import { installTemplateSave } from './drawing-template-ui.js';
import { drawingAttributeContext } from './drawing-attributes.js';
import { applyDrawingFont, drawingFont } from './drawing-preferences.js';
import { migrateIndependentPartViews, arrangePartViews } from './part-view-migration.js';
import { migratePartSection } from './part-section-migration.js';
import { DrawingViewActions } from './drawing-view-actions.js';
import { duplicateDrawingView } from './drawing-views.js';
import { nextSectionName } from './drawing-sections.js';
import { nextDetailLabel } from './drawing-details.js';
import { PartViewTool } from './part-view-tool.js';
import { migratePartOrientation } from './part-section-orientation.js';
import { partDrawingReflection } from './part-view-frame.js';
import { DrawingDetailTool } from './drawing-detail-tool.js';
import { appendViewTitle } from './drawing-view-title.js';
import { DrawingSectionTool } from './drawing-section-tool.js';
import { PartSections } from './part-sections.js';
import {
  ensurePartViews,
  partViewScales,
  viewById,
  setDrawingViewScale,
  drawingViewAtPoint,
} from './drawing-views.js';
import { DrawingWorkspace, drawingEditorShell } from './drawing-workspace.js';
import { pasteboardBounds } from './drawing-pasteboard.js';
import {
  findDrawingLayout,
  layoutPicker,
  fillLayoutPicker,
  appendDrawingLayout,
} from './drawing-layout.js';
import { DrawingAnnotations } from './drawing-annotations.js';
import { actionButton, actionMenu } from './drawing-toolbar.js';
import { objectGeometry } from './model-object.js';
import { partMatrix } from './part-marks.js';
import { updatePartHolePanel, partHoleSchedule } from './fasteners/drawing.js';
import {
  PAPER_KEY,
  standardPapers,
  validatePaper,
  paperSize,
  sheetLayout,
} from './paper-formats.js';
const NS = 'http://www.w3.org/2000/svg';
const node = (tag, attrs = {}, text) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text !== undefined) el.textContent = text;
  return el;
};
export class SinglePartSheet {
  constructor({
    getAttributeState = () => ({}),
    getObjects,
    getProject = () => ({}),
    getSnapSettings = () => ({ polar: 45 }),
  }) {
    this.getSnapSettings = getSnapSettings;
    this.getProject = getProject;
    this.getObjects = getObjects;
    this.getAttributeState = getAttributeState;
    this.base = 1;
    this.zoom = 1;
    this.papers = structuredClone(standardPapers);
    try {
      const data = JSON.parse(localStorage.getItem(PAPER_KEY));
      if (Array.isArray(data) && data.length <= 50) {
        for (const p of data) validatePaper(p);
        if (data.length && new Set(data.map((p) => p.id)).size === data.length) this.papers = data;
      }
    } catch {}
    const shell = createSinglePartShell();
    const { body, inspector } = shell;
    Object.assign(this, {
      dialog: shell.dialog,
      $: shell.$,
      svg: shell.svg,
      workspace: shell.workspace,
      stage: shell.stage,
    });
    this.dialog.addEventListener('close', () => {
      this.save?.(this.record);
      this.geometry?.dispose();
      this.geometry = null;
    });
    this.$('selected-view').onchange = () => this.selectView(this.$('selected-view').value);
    this.svg.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const g = e.target.closest('[data-view]');
        if (g) {
          e.preventDefault();
          this.selectView(g.dataset.view);
        }
      }
    });
    this.layoutSelect = layoutPicker(
      inspector.querySelector('.sheet-properties'),
      'sheet-frame-layout',
      (id) => {
        this.config.layoutId = id;
        this.render();
        this.fit();
      },
    );
    const hiddenLabel = document.createElement('label');
    hiddenLabel.className = 'drawing-check';
    hiddenLabel.innerHTML = '<input id=sheet-hidden-lines type=checkbox>Visa skymda kanter';
    inspector.querySelector('.view-properties').append(hiddenLabel);
    this.$('hidden-lines').onchange = () => {
      viewById(this.config, this.selectedView).settings.hiddenLines =
        this.$('hidden-lines').checked;
      this.render();
    };
    const toolbar = this.dialog.querySelector('.sheet-toolbar');
    toolbar.classList.add('drawing-commandbar');
    toolbar.setAttribute('aria-label', 'Ritningsverktyg');
    toolbar.prepend(actionButton(this.$('fit'), 'fit', 'Visa blad'));
    actionButton(this.$('layout'), 'layout', 'Ordna vyer');
    this.$('layout').title = 'Återställ vyernas placering på bladet';
    actionMenu(toolbar, {
      label: 'Mer',
      items: [actionButton(this.$('review'), 'check', 'Markera som aktuell')],
    });
    const fitAll = actionButton(document.createElement('button'), 'fit', 'Visa allt');
    fitAll.title = 'Visa papper och allt innehåll, även utanför pappret';
    fitAll.onclick = () => this.fit(true);
    this.$('fit').after(fitAll);
    const existingTools = new Set(toolbar.children);
    this.annotations = new DrawingAnnotations({
      dialog: this.dialog,
      surface: this.svg,
      toolbar,
      adapter: {
        redraw: () => this.compose(),
        pixelScale: () => this.svg.getBoundingClientRect().width / this.paper[0],
        unit: () => 1,
        project: (p, v) => this.projectAnnotation(p, v),
        locate: (e, v) => this.locateAnnotation(e, v),
        candidates: (v) => this.annotationCandidates[v] || [],
        referenceSource: () => 'part',
        pick: () => this.record.sourceId,
        mark: (id) => (id === this.record.sourceId ? this.record.mark : null),
      },
    });
    installTemplateSave(this, toolbar);
    drawingEditorShell({
      dialog: this.dialog,
      body,
      toolbar,
      tools: [...toolbar.children].filter((child) => !existingTools.has(child)),
      cancel: () => this.cancelInteraction(),
    });
    for (const key of ['paper', 'orientation'])
      this.$(key).onchange = () => {
        if (key === 'paper')
          this.config.paper = structuredClone(
            this.papers.find((p) => p.id === this.$('paper').value),
          );
        this.config.landscape = this.$('orientation').value === 'landscape';
        this.render();
        this.fit();
      };
    for (const id of ['top', 'front'])
      this.$('scale-' + id).oninput = () => {
        const scale = Number(this.$('scale-' + id).value);
        if (!Number.isFinite(scale) || scale < 0.1 || scale > 1000) return;
        setDrawingViewScale(viewById(this.config, id), scale);
        this.render();
      };
    this.$('layout').onclick = () => {
      arrangePartViews(this.config.views, this.paper[0]);
      this.compose();
    };
    this.$('fit').onclick = () => this.fit();
    this.$('review').onclick = () => this.review(this.record);
    this.$('library').onclick = () => this.openLibrary();
    this.navigation = new DrawingWorkspace({
      workspace: this.workspace,
      stage: this.stage,
      paper: this.svg,
      getPaper: () => this.paper,
      getBounds: () => this.contentBounds,
      blocked: () => !!(this.drag || this.annotations.drag),
    });
    this.svg.onpointerdown = (e) => {
      const group = e.target.closest('[data-view]');
      if (!group || e.button !== 0) return;
      e.preventDefault();
      this.selectView(group.dataset.view);
      if (!e.target.closest('.viewport-grip,[data-section-crop]')) return;
      this.svg.setPointerCapture(e.pointerId);
      this.drag = {
        pointerId: e.pointerId,
        view: group.dataset.view,
        x: e.clientX,
        y: e.clientY,
        crop: e.target.closest('[data-section-crop]')
          ? {
              corner: e.target.closest('[data-section-crop]').dataset.sectionCrop,
              view: structuredClone(this.extraSections.selected()),
            }
          : null,
        extra: this.extraSections.selected() ? [...this.extraSections.selected().position] : null,
        factor: this.paper[0] / this.svg.getBoundingClientRect().width,
      };
    };
    this.svg.onpointermove = (e) => {
      if (!this.drag) return;
      const d = this.drag,
        dx = (e.clientX - d.x) * d.factor,
        dy = (e.clientY - d.y) * d.factor;
      if (d.crop) {
        this.extraSections.crop(d.crop.view, d.crop.corner, [dx, dy]);
        this.compose();
        return;
      }
      if (d.extra) {
        const view = this.config.views.find((v) => v.id === d.view);
        view.position = [d.extra[0] + dx, d.extra[1] + dy];
        this.compose();
        return;
      }
    };
    this.svg.onpointerup = this.svg.onpointercancel = () => (this.drag = null);
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Vynamn';
    this.viewName = document.createElement('input');
    this.viewName.maxLength = 80;
    nameLabel.append(this.viewName);
    this.dialog.querySelector('.view-properties').append(nameLabel);
    this.viewName.onchange = () => {
      const view = this.config.views?.find((v) => v.id === this.selectedView);
      if (view) {
        view.name = this.viewName.value.trim() || view.name;
        this.compose();
      }
    };
    this.extraSections = new PartSections(this);
    this.viewActions = new DrawingViewActions(this.dialog, {
      views: () => this.config.views,
      annotations: () => this.annotations.items,
      hit: (event) =>
        event.target.closest('.viewport-grip,[data-section-crop]')?.closest('[data-view]')?.dataset
          .view,
      select: (id) => this.selectView(id),
      cancel: () => this.cancelInteraction(),
      duplicate: (id) => {
        const { view, annotations } = duplicateDrawingView(
          this.config.views.find((v) => v.id === id),
          this.config.views,
          this.annotations.items,
        );
        if (view.section) {
          view.section.label = nextSectionName(this.config.views);
          view.name = `Snitt ${view.section.label}–${view.section.label}`;
        }
        if (view.detail) {
          view.detail.label = nextDetailLabel(this.config.views);
          view.name = 'Detalj ' + view.detail.label;
        }
        this.annotations.items.push(...annotations);
        this.config.views.push(view);
        this.extraSections.build();
        this.compose();
        this.selectView(view.id);
      },
      remove: (ids) => {
        this.cancelInteraction();
        this.config.views = this.config.views.filter((v) => !ids.has(v.id));
        this.annotations.items = this.record.annotations = this.annotations.items.filter(
          (a) => !ids.has(a.view),
        );
        this.annotations.history = [];
        this.annotations.future = [];
        this.selectedView = this.config.views[0].id;
        this.render();
      },
      changed: (id) => {
        this.compose();
        this.selectView(id);
      },
    });
    this.viewTool = new PartViewTool(this, toolbar);
    this.sectionTool = new DrawingSectionTool({
      dialog: this.dialog,
      workspace: this.workspace,
      toolbar: this.dialog.querySelector('.sheet-tools'),
      inspector,
      adapter: {
        getSnapSettings: this.getSnapSettings,
        feedback: this.annotations,
        cancel: () => this.cancelInteraction(),
        views: () => this.config.views || [],
        selected: () => this.config.views?.find((v) => v.id === this.selectedView),
        markers: (id) => this.extraSections.markers(id),
        locate: (event, id) => this.annotations.location(event, id, true),
        paperPoint: (event) => {
          const r = this.svg.getBoundingClientRect();
          return [
            ((event.clientX - r.left) * this.paper[0]) / r.width,
            ((event.clientY - r.top) * this.paper[1]) / r.height,
          ];
        },
        redraw: () => this.compose(),
        commit: (view) => this.extraSections.commit(view),
        update: (view) => this.extraSections.update(view),
      },
    });
    this.detailTool = new DrawingDetailTool({
      dialog: this.dialog,
      workspace: this.workspace,
      toolbar: this.dialog.querySelector('.sheet-tools'),
      inspector,
      adapter: {
        getSnapSettings: this.getSnapSettings,
        feedback: this.annotations,
        cancel: () => this.cancelInteraction(),
        views: () => this.config.views || [],
        selected: () => this.config.views?.find((v) => v.id === this.selectedView),
        locate: (event, id) => this.annotations.location(event, id, true),
        paperPoint: (event) => {
          const r = this.svg.getBoundingClientRect();
          return [
            ((event.clientX - r.left) * this.paper[0]) / r.width,
            ((event.clientY - r.top) * this.paper[1]) / r.height,
          ];
        },
        redraw: () => this.compose(),
        commit: (view) => this.extraSections.commit(view),
        update: (view) => this.extraSections.update(view),
      },
    });
  }
  cancelInteraction() {
    this.viewActions?.cancel();
    this.viewTool?.cancel();
    this.sectionTool?.cancel();
    this.detailTool?.cancel();
    this.navigation?.pan.cancel();
    if (this.drag) {
      const drag = this.drag;
      this.drag = null;
      if (drag.crop) {
        Object.assign(this.extraSections.selected(), drag.crop.view);
        this.extraSections.build();
      }
      if (drag.extra) {
        const view = this.config.views.find((v) => v.id === drag.view);
        if (view) view.position = [...drag.extra];
      }
      if (this.svg.hasPointerCapture(drag.pointerId))
        this.svg.releasePointerCapture(drag.pointerId);
    }
    if (this.annotations) {
      this.annotations.endDrag(true);
      this.annotations.selected = null;
      this.annotations.cancel();
    }
  }
  openRecord(record, { save, review }) {
    this.record = structuredClone(record);
    if (this.fontSelect) this.fontSelect.value = drawingFont(this.record);
    for (const a of this.record.annotations || [])
      if (a.sourceId && !a.manual) a.sourceId = record.sourceId;
    this.save = save;
    this.review = review;
    const source = this.getObjects().find((s) => s.id === record.sourceId);
    if (!source) return;
    this.geometry = objectGeometry(source, this.getObjects());
    const localMatrix = partMatrix(source);
    this.holeSchedule = partHoleSchedule(source, this.getObjects(), localMatrix);
    updatePartHolePanel(
      this.dialog.querySelector('.drawing-inspector'),
      source,
      this.getObjects(),
      localMatrix,
    );
    this.drawingReflection = partDrawingReflection(localMatrix);
    this.geometryInDrawingFrame = false;
    this.geometry.applyMatrix4(localMatrix);
    this.geometry.computeBoundingBox();
    this.bounds = this.geometry.boundingBox.clone();
    if (!this.record.sheet && this.record.template) {
      const templateGeometry = this.geometry.clone();
      if (this.drawingReflection) templateGeometry.applyMatrix4(this.drawingReflection);
      this.record.sheet = instantiateDrawingTemplate(
        this.record.template,
        templateGeometry,
        record.sourceId,
      );
      templateGeometry.dispose();
    }
    this.config = this.record.sheet || {
      paper: structuredClone(this.papers.find((p) => p.id === 'A3') || this.papers[0]),
      landscape: true,
      scale: 10,
      section: (this.bounds.min.x + this.bounds.max.x) / 2,
      layout: null,
      layoutId: this.record.drawingPreset?.layoutId || '',
    };
    this.record.sheet = this.config;
    ensurePartViews(this.record);
    fillLayoutPicker(this.layoutSelect, this.config.layoutId);
    this.dialog.querySelector('header strong').textContent = `${record.number} · ${record.mark}`;
    this.paperOptions();
    this.$('orientation').value = this.config.landscape ? 'landscape' : 'portrait';
    for (const v of ['top', 'front', 'section'])
      this.$('scale-' + v).value = partViewScales(this.config)[v];
    this.$('section').value = this.config.section;
    this.$('section').min = this.bounds.min.x;
    this.$('section').max = this.bounds.max.x;
    this.annotations.open(this.record);
    this.dialog.showModal();
    this.selectedView =
      this.config.views.find((v) => v.id === 'front')?.id || this.config.views[0].id;
    this.syncInspector();
    this.render();
    this.fit();
  }
  selectView(view) {
    this.selectedView = view;
    this.syncInspector();
    for (const group of this.svg.querySelectorAll('[data-view]')) {
      const active = group.dataset.view === view;
      group.setAttribute('aria-pressed', String(active));
      group
        .querySelector('.viewport-frame')
        ?.setAttribute('stroke', active ? '#589383' : '#c5d0d4');
    }
    if (this.extraSections?.items.length) this.compose();
  }
  syncInspector() {
    if (this.viewName)
      this.viewName.value =
        this.config.views?.find((v) => v.id === this.selectedView)?.name ||
        { top: 'Top', front: 'Front', section: 'Sektion A–A' }[this.selectedView] ||
        '';
    this.$('hidden-lines').checked = !!viewById(this.config, this.selectedView)?.settings
      .hiddenLines;
    this.$('selected-view').value = this.selectedView;
    for (const v of ['top', 'front', 'section']) this.$('scale-' + v).parentElement.hidden = true;
    this.$('section').parentElement.hidden = true;
    this.$('scale-section').parentElement.hidden = true;
    this.extraSections?.sync();
  }
  frame(group, id, x, y, width, height) {
    group.setAttribute('tabindex', '0');
    group.setAttribute('role', 'button');
    group.setAttribute(
      'aria-label',
      id === 'top' ? 'Välj vy ovanifrån' : id === 'front' ? 'Välj huvudvy' : 'Välj sektion A–A',
    );
    group.setAttribute('aria-pressed', String(this.selectedView === id));
    group.append(
      node('rect', {
        class: 'viewport-grip',
        x,
        y,
        width,
        height,
        rx: 1,
        fill: 'none',
        stroke: 'transparent',
        'stroke-width': 10,
        'vector-effect': 'non-scaling-stroke',
        'pointer-events': 'stroke',
      }),
    );
    group.prepend(
      node('rect', {
        class: 'viewport-frame',
        x,
        y,
        width,
        height,
        rx: 1,
        fill: 'transparent',
        stroke: this.selectedView === id ? '#589383' : '#c5d0d4',
        'stroke-width': 1,
        'vector-effect': 'non-scaling-stroke',
      }),
    );
  }
  paperOptions() {
    const list = [...this.papers];
    if (!list.some((p) => p.id === this.config.paper.id)) list.push(this.config.paper);
    this.$('paper').replaceChildren(
      ...list.map((p) => new Option(`${p.name} · ${p.width} × ${p.height}`, p.id)),
    );
    this.$('paper').value = this.config.paper.id;
  }
  projectAnnotation(p, view) {
    const item = this.config.views.find((v) => v.id === view);
    return this.extraSections.project(p, item);
  }

  locateAnnotation(e, view) {
    const r = this.svg.getBoundingClientRect(),
      x = ((e.clientX - r.left) * this.paper[0]) / r.width,
      y = ((e.clientY - r.top) * this.paper[1]) / r.height;
    view ??=
      e.target.closest('[data-view]')?.dataset.view ||
      drawingViewAtPoint(this.config.views, [x, y], this.selectedView)?.id;
    if (!view) return null;
    const origin = this.projectAnnotation([0, 0], view),
      s =
        partViewScales(this.config)[view] ||
        this.extraSections.items.find((v) => v.id === view)?.scale;
    return { view, point: [(x - origin[0]) * s, (origin[1] - y) * s] };
  }
  render() {
    this.$('review').disabled = false;
    this.frameLayout = findDrawingLayout(this.config.layoutId);
    this.paper = this.frameLayout
      ? [this.frameLayout.width, this.frameLayout.height]
      : paperSize(this.config.paper, this.config.landscape);
    this.$('paper').disabled = this.$('orientation').disabled = !!this.frameLayout;
    for (const key of ['paper', 'orientation'])
      this.$(key).parentElement.hidden = !!this.frameLayout;
    this.$('library').hidden = !!this.frameLayout;
    if (!this.config.layout)
      this.config.layout = sheetLayout(this.bounds, partViewScales(this.config), this.paper);
    migratePartSection(this.record, this.bounds);
    const frame = (view, orientation) => this.extraSections.frame(view, orientation);
    migratePartOrientation(this.record, frame);
    if (this.drawingReflection) {
      migratePartOrientation(this.record, frame, this.drawingReflection);
      if (!this.geometryInDrawingFrame) {
        this.geometry.applyMatrix4(this.drawingReflection);
        this.geometry.computeBoundingBox();
        this.bounds = this.geometry.boundingBox.clone();
      }
    }
    this.geometryInDrawingFrame = true;
    migrateIndependentPartViews(this.config, this.bounds);
    this.annotationCandidates = {};
    this.extraSections?.build();
    this.compose();
    this.syncInspector();
  }
  compose() {
    applyDrawingFont(this.svg, this.record);
    const [w, h] = this.paper,
      c = this.config;
    this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.svg.replaceChildren(
      node('rect', {
        'data-paper-boundary': 'true',
        width: w,
        height: h,
        fill: 'white',
        stroke: '#899ba4',
        'stroke-width': 1,
        'vector-effect': 'non-scaling-stroke',
        'pointer-events': 'none',
      }),
    );
    const boxes = [];
    for (const v of this.extraSections.items)
      boxes.push([
        v.position[0],
        v.position[1],
        v.position[0] + v.size[0],
        v.position[1] + v.size[1],
      ]);
    this.$('message').textContent = boxes.some(
      ([x, y, r, bot]) => x < 0 || y < 0 || r > w || bot > h,
    )
      ? 'En vy ligger utanför bladet. Ändra skala, format eller placering.'
      : `${this.frameLayout?.name || c.paper.name} · ${w} × ${h} mm · skalor anges vid respektive vy`;
    this.extraSections.paint();
    this.extraSections.options();
    for (const view of this.config.views) {
      this.sectionTool?.paint(this.svg, view.id, (p) => this.projectAnnotation(p, view.id), 1);
      this.detailTool?.paint(this.svg, view.id, (p) => this.projectAnnotation(p, view.id), 1);
      appendViewTitle(this.svg, view, view.position[0] + 1, view.position[1] + view.size[1]);
    }
    appendDrawingLayout(
      this.svg,
      this.frameLayout,
      drawingAttributeContext(this.record, this.getAttributeState()),
    );
    this.annotations.render(this.svg);
    const guides = [...this.svg.querySelectorAll('.section-extent-guides')];
    guides.forEach((n) => (n.style.display = 'none'));
    this.contentBounds = pasteboardBounds(this.paper, this.svg.getBBox());
    guides.forEach((n) => n.style.removeProperty('display'));
    this.size();
  }
  size() {
    if (this.paper) this.navigation.size();
  }
  fit(all = false) {
    this.navigation.fit(all);
  }
  openLibrary() {
    if (!this.library) {
      this.library = document.createElement('dialog');
      this.library.id = 'paper-library';
      this.library.innerHTML =
        '<h2>Pappersbibliotek</h2><p>Format i mm. Ändringar gäller nya val av format.</p><form><div class="paper-rows"></div><button type="button" id="paper-add">Eget format</button><p role="alert"></p><button class="primary">Spara bibliotek</button><button type="button" id="paper-cancel">Avbryt</button></form>';
      document.body.append(this.library);
      this.library.addEventListener('keydown', (e) => e.stopPropagation());
      this.library.querySelector('#paper-cancel').onclick = () => this.library.close();
      this.library.querySelector('#paper-add').onclick = () => {
        this.draft.push({ id: crypto.randomUUID(), name: 'Eget format', width: 420, height: 297 });
        this.libraryRows();
      };
      this.library.querySelector('form').onsubmit = (e) => {
        e.preventDefault();
        try {
          if (this.draft.length > 50) throw Error('Högst 50 format.');
          this.draft.forEach(validatePaper);
          localStorage.setItem(PAPER_KEY, JSON.stringify(this.draft));
          this.papers = structuredClone(this.draft);
          if (this.config) this.paperOptions();
          this.library.close();
        } catch (e) {
          this.library.querySelector('[role=alert]').textContent = e.message;
        }
      };
    }
    this.draft = structuredClone(this.papers);
    this.libraryRows();
    this.library.querySelector('[role=alert]').textContent = '';
    this.library.showModal();
  }
  libraryRows() {
    const root = this.library.querySelector('.paper-rows');
    root.replaceChildren();
    for (const p of this.draft) {
      const row = document.createElement('div');
      row.className = 'paper-row';
      for (const key of ['name', 'width', 'height']) {
        const input = document.createElement('input');
        input.type = key === 'name' ? 'text' : 'number';
        input.value = p[key];
        input.required = true;
        input.setAttribute(
          'aria-label',
          `${p.name} ${key === 'name' ? 'namn' : key === 'width' ? 'bredd' : 'höjd'}`,
        );
        input.oninput = () => (p[key] = key === 'name' ? input.value : Number(input.value));
        row.append(input);
      }
      root.append(row);
    }
  }
}
