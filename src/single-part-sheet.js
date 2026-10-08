import { createSinglePartShell } from './drawing/ui/single-part-shell.js';
import { appendDrawingViewGrips, updateDrawingViewGripSizes } from './drawing-view-grips.js';
import { createDrawingViewInspector } from './drawing-view-inspector.js';
import { resizeDrawingView } from './drawing-views.js';
import { drawingProfileDetail } from './profile-detail.js';
import { installDrawingProfileDetail } from './drawing-profile-detail.js';
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
import { objectGeometry, displayGeometry } from './model-object.js';
import { partMatrix } from './part-marks.js';
import { partStatus } from './part-marks.js';
import { assemblyGeometry } from './assembly-geometry.js';
import {
  normalizeAssemblySchedule,
  assemblyScheduleTable,
  newMaterialSchedule,
} from './assembly-schedule.js';
import {
  appendMaterialSchedule,
  materialScheduleHeight,
  materialSchedulePosition,
} from './assembly-material-schedule.js';
import { editAssemblySchedule } from './assembly-schedule-editor.js';
import {
  normalizeSinglePartMaterialSchedule,
  singlePartMaterialPosition,
  singlePartMaterialData,
  appendSinglePartMaterialSchedule,
  singlePartMaterialSize,
} from './single-part-material-schedule.js';
import { assemblySchedule } from './project/assemblies.js';
import { assemblyDrawingMatrix } from './assembly-frames.js';
import { drawingAssemblies } from './assembly-numbering.js';
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
      this.snapGeometry?.dispose();
      this.snapGeometry = null;
      this.disposeAssembly();
      this.disposeProfileVariants();
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
    this.assemblyPanel = document.createElement('details');
    this.assemblyPanel.hidden = true;
    const summary = document.createElement('summary');
    summary.textContent = 'Stycklista';
    this.assemblyPanel.append(summary);
    for (const [key, title] of [
      ['visible', 'Visa på bladet'],
      ['x', 'X på blad · mm'],
      ['y', 'Y på blad · mm'],
    ]) {
      const label = document.createElement('label'),
        input = document.createElement('input');
      label.textContent = title;
      input.type = key === 'visible' ? 'checkbox' : 'number';
      if (key !== 'visible') input.step = 'any';
      input.setAttribute('aria-label', 'Stycklista · ' + title);
      input.dataset.scheduleField = key;
      const update = () => {
        const settings = this.config.assemblySchedule;
        if (key === 'visible') settings.visible = input.checked;
        else if (input.value.trim() && Number.isFinite(Number(input.value))) {
          settings.position[key === 'x' ? 0 : 1] = Number(input.value);
          settings.dockToTitle = false;
        }
        this.compose();
      };
      input.onchange = update;
      if (key !== 'visible') input.oninput = update;
      label.append(input);
      this.assemblyPanel.append(label);
    }
    const editSchedule = document.createElement('button');
    editSchedule.textContent = 'Redigera stycklista…';
    editSchedule.onclick = () =>
      editAssemblySchedule(
        this.config.assemblySchedule,
        assemblySchedule(this.assembly, this.getAttributeState()),
        (settings) => {
          this.config.assemblySchedule = settings;
          this.compose();
        },
      );
    this.assemblyPanel.append(editSchedule);
    const placeSchedule = document.createElement('button');
    placeSchedule.textContent = 'Placera materiallista vid rithuvud';
    placeSchedule.onclick = () => {
      this.config.assemblySchedule.dockToTitle = true;
      const table = assemblyScheduleTable(
        assemblySchedule(this.assembly, this.getAttributeState()),
        this.config.assemblySchedule,
      );
      this.config.assemblySchedule.position = materialSchedulePosition(
        table,
        this.paper,
        this.frameLayout,
      );
      this.compose();
    };
    this.assemblyPanel.append(placeSchedule);
    inspector.append(this.assemblyPanel);
    this.partMaterialPanel = document.createElement('details');
    this.partMaterialPanel.hidden = true;
    const materialSummary = document.createElement('summary');
    materialSummary.textContent = 'Materiallista';
    this.partMaterialPanel.append(materialSummary);
    for (const [key, title] of [
      ['visible', 'Visa på bladet'],
      ['x', 'X på blad · mm'],
      ['y', 'Y på blad · mm'],
    ]) {
      const label = document.createElement('label'),
        input = document.createElement('input');
      label.textContent = title;
      input.type = key === 'visible' ? 'checkbox' : 'number';
      input.dataset.materialField = key;
      input.setAttribute('aria-label', 'Materiallista · ' + title);
      if (key !== 'visible') input.step = 'any';
      input.onchange = () => {
        const settings = this.config.partMaterialSchedule;
        if (key === 'visible') settings.visible = input.checked;
        else if (input.value.trim() && Number.isFinite(Number(input.value))) {
          settings.position[key === 'x' ? 0 : 1] = Number(input.value);
          settings.dockToTop = false;
        }
        this.compose();
      };
      label.append(input);
      this.partMaterialPanel.append(label);
    }
    const dockMaterial = document.createElement('button');
    dockMaterial.textContent = 'Placera uppe till höger';
    dockMaterial.onclick = () => {
      this.config.partMaterialSchedule.dockToTop = true;
      this.compose();
    };
    this.partMaterialPanel.append(dockMaterial);
    inspector.append(this.partMaterialPanel);
    const hiddenLabel = document.createElement('label');
    hiddenLabel.className = 'drawing-check';
    hiddenLabel.innerHTML = '<input id=sheet-hidden-lines type=checkbox>Visa skymda kanter';
    inspector.querySelector('.view-properties').append(hiddenLabel);
    this.$('hidden-lines').onchange = () => {
      viewById(this.config, this.selectedView).settings.hiddenLines =
        this.$('hidden-lines').checked;
      this.render();
    };
    this.profileDetailControl = installDrawingProfileDetail(
      inspector.querySelector('.view-properties'),
      {
        view: () => viewById(this.config || {}, this.selectedView),
        drawingType: () => this.record?.type || 'SP',
        changed: () => this.render(),
      },
    );
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
        cancelTools: () => this.cancelInteraction(),
        redraw: () => this.compose(),
        pixelScale: () => this.svg.getBoundingClientRect().width / this.paper[0],
        unit: () => 1,
        project: (p, v) => this.projectAnnotation(p, v),
        locate: (e, v) => this.locateAnnotation(e, v),
        candidates: (v) => this.annotationCandidates[v] || [],
        referenceSource: (id) => (this.record.type === 'AS' ? id : 'part'),
        pick: (_event, hit) =>
          this.record.type === 'AS' ? hit.reference?.source : this.record.sourceId,
        mark: (id) => {
          if (this.record.type !== 'AS')
            return id === this.record.sourceId ? this.record.mark : null;
          const state = this.getAttributeState(),
            object = state.objects.find((o) => o.id === id);
          if (!object || !this.assembly.memberIds.includes(id)) return null;
          const status = partStatus(object, state.objects, state.parts);
          return status.valid ? status.mark : null;
        },
      },
    });
    installTemplateSave(this, toolbar);
    drawingEditorShell({
      dialog: this.dialog,
      body,
      toolbar,
      tools: [...toolbar.children].filter((child) => !existingTools.has(child)),
      cancel: () => this.cancelInteraction(),
      save: () => this.save?.(this.record),
      annotations: () => this.annotations,
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
      arrangePartViews(this.config.views, this.paper[0], this.frameLayout?.contentArea);
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
      onScale: (scale) => updateDrawingViewGripSizes(this.svg, scale),
    });
    this.svg.onpointerdown = (e) => {
      const group = e.target.closest('[data-view]');
      if (!group || e.button !== 0) return;
      e.preventDefault();
      this.selectView(group.dataset.view);
      if (!e.target.closest('.viewport-grip,[data-section-crop],[data-view-grip]')) return;
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
    this.svg.onpointerup = (e) => {
      this.drag = null;
      if (this.svg.hasPointerCapture(e.pointerId)) this.svg.releasePointerCapture(e.pointerId);
      this.viewPlacement?.sync();
    };
    this.svg.onpointercancel = () => {
      this.cancelInteraction();
      this.compose();
    };
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
    this.viewPlacement = createDrawingViewInspector(this.dialog.querySelector('.view-properties'), {
      selected: () => this.config?.views.find((v) => v.id === this.selectedView),
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
        this.extraSections.build();
        this.compose();
      },
    });
    this.viewActions = new DrawingViewActions(this.dialog, {
      views: () => this.config.views,
      annotations: () => this.annotations.items,
      hit: (event) => event.target.closest('[data-view]')?.dataset.view,
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
        this.extraSections.build();
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
    this.disposeAssembly();
    this.disposeProfileVariants();
    this.record = structuredClone(record);
    if (this.fontSelect) this.fontSelect.value = drawingFont(this.record);
    for (const a of this.record.annotations || [])
      if (record.type !== 'AS' && a.sourceId && !a.manual) a.sourceId = record.sourceId;
    this.save = save;
    this.review = review;
    const source = this.getObjects().find((s) => s.id === record.sourceId);
    if (!source) return;
    this.geometry?.dispose();
    const state = this.getAttributeState();
    this.assembly =
      record.type === 'AS' ? state.assemblies.find((a) => a.id === record.assemblyId) : null;
    const assemblyData = this.assembly ? assemblyGeometry(this.assembly, this.getObjects()) : null;
    this.assemblyEntries = assemblyData?.entries;
    this.geometry = assemblyData?.geometry || objectGeometry(source, this.getObjects());
    const localMatrix = assemblyData?.matrix || partMatrix(source);
    this.profileGeometryModel = this.getObjects();
    this.profileGeometrySource = source;
    this.profileGeometryAssembly = this.assembly;
    this.profileLocalMatrix = localMatrix.clone();
    this.snapGeometry?.dispose();
    this.snapGeometry =
      assemblyData?.snapGeometry ||
      displayGeometry(source, this.getObjects(), 'schematic').applyMatrix4(localMatrix);
    this.holeSchedule = this.assemblyEntries
      ? this.assemblyEntries.flatMap((e) =>
          partHoleSchedule(
            this.getObjects().find((o) => o.id === e.id),
            this.getObjects(),
            localMatrix,
          ).map((h) => ({ ...h, sourceId: e.id })),
        )
      : partHoleSchedule(source, this.getObjects(), localMatrix);
    updatePartHolePanel(
      this.dialog.querySelector('.drawing-inspector'),
      source,
      this.getObjects(),
      localMatrix,
    );
    if (this.assembly) {
      const panel = this.dialog.querySelector('[data-part-holes]');
      panel.replaceChildren();
      panel.hidden = !this.holeSchedule.length;
      const summary = document.createElement('summary');
      summary.textContent = `Hål i assembly · ${this.holeSchedule.length}`;
      panel.append(summary);
      for (const h of this.holeSchedule) {
        const p = document.createElement('p');
        p.className = 'inspector-note';
        p.textContent = `${state.parts.assignments[h.sourceId]?.mark || 'Ej numrerad'} · ${h.label}`;
        panel.append(p);
      }
    }
    this.drawingReflection = partDrawingReflection(localMatrix);
    this.geometryInDrawingFrame = false;
    if (!assemblyData) this.geometry.applyMatrix4(localMatrix);
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
    const newSheet = !this.record.sheet;
    this.config = this.record.sheet || {
      paper: structuredClone(this.papers.find((p) => p.id === 'A3') || this.papers[0]),
      landscape: true,
      scale: this.assembly
        ? Math.max(
            10,
            Math.ceil(
              Math.max(
                this.bounds.max.x - this.bounds.min.x,
                this.bounds.max.y - this.bounds.min.y,
                this.bounds.max.z - this.bounds.min.z,
              ) /
                Math.max(
                  25,
                  (findDrawingLayout(this.record.drawingPreset?.layoutId)?.width || 420) - 40,
                ) /
                5,
            ) * 5,
          )
        : 10,
      section: (this.bounds.min.x + this.bounds.max.x) / 2,
      layout: null,
      layoutId: this.record.drawingPreset?.layoutId || '',
    };
    this.record.sheet = this.config;
    if (this.assembly) this.config.assemblyModelMatrix = assemblyDrawingMatrix(source).toArray();
    ensurePartViews(this.record);
    if (this.assembly && !this.config.assemblyViews) {
      const side = structuredClone(this.config.views.find((v) => v.id === 'front'));
      Object.assign(side, {
        id: 'right',
        name: 'Sidovy',
        projection: 'right',
        standard: true,
        size: [1, 1],
      });
      const b = this.bounds;
      side.camera.center = [(b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2];
      side.size = [
        Math.max(25, (b.max.y - b.min.y) / side.scale + 12),
        Math.max(25, (b.max.z - b.min.z) / side.scale + 12),
      ];
      side.position = [10, 10];
      this.config.views.push(side);
      this.config.assemblyViews = true;
      this.config.assemblySchedule ??= newMaterialSchedule();
    }
    if (this.assembly)
      this.config.assemblySchedule = normalizeAssemblySchedule(this.config.assemblySchedule);
    this.assemblyPanel.hidden = !this.assembly;
    this.partMaterialPanel.hidden = !!this.assembly;
    if (!this.assembly)
      this.config.partMaterialSchedule = normalizeSinglePartMaterialSchedule(
        this.config.partMaterialSchedule,
      );
    this.svg.setAttribute(
      'aria-label',
      this.assembly ? 'Assembly ritningsblad' : 'Single Part ritningsblad',
    );
    fillLayoutPicker(this.layoutSelect, this.config.layoutId);
    this.dialog.querySelector('header strong').textContent =
      `${record.number} · ${record.type === 'AS' ? record.name : record.mark}`;
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
    if (newSheet && !this.assembly) {
      const area = [
        ...(this.frameLayout?.contentArea || [10, 10, this.paper[0] - 10, this.paper[1] - 60]),
      ];
      if (this.config.partMaterialSchedule.visible) area[1] += singlePartMaterialSize[1] + 2;
      arrangePartViews(this.config.views, this.paper[0], area);
      this.compose();
    }
    if (this.assembly && !this.config.assemblyArranged) {
      arrangePartViews(this.config.views, this.paper[0], this.frameLayout?.contentArea);
      const bottom = Math.max(...this.config.views.map((v) => v.position[1] + v.size[1])) + 14;
      const table = assemblyScheduleTable(
        assemblySchedule(this.assembly, this.getAttributeState()),
        this.config.assemblySchedule,
      );
      this.config.assemblySchedule.position =
        table.settings.style === 'material'
          ? materialSchedulePosition(table, this.paper, this.frameLayout)
          : [10, bottom];
      this.config.assemblyArranged = true;
      this.compose();
    }
    this.fit();
  }
  disposeAssembly() {
    for (const e of this.assemblyEntries || []) {
      e.geometry.dispose();
      e.snapGeometry.dispose();
    }
    this.assemblyEntries = null;
    this.assembly = null;
  }
  disposeProfileVariants() {
    for (const variant of this.profileVariants?.values() || []) {
      variant.geometry.dispose();
      variant.snapGeometry.dispose();
      for (const entry of variant.entries || []) {
        entry.geometry.dispose();
        entry.snapGeometry.dispose();
      }
    }
    this.profileVariants = new Map();
  }
  drawingGeometry(view) {
    const detail = drawingProfileDetail(view, this.record.type);
    if (detail === 'exact')
      return {
        geometry: this.geometry,
        snapGeometry: this.snapGeometry,
        entries: this.assemblyEntries,
      };
    let variant = this.profileVariants.get(detail);
    if (!variant) {
      variant = this.profileGeometryAssembly
        ? assemblyGeometry(this.profileGeometryAssembly, this.profileGeometryModel, detail)
        : {
            geometry: objectGeometry(
              this.profileGeometrySource,
              this.profileGeometryModel,
              detail,
            ).applyMatrix4(this.profileLocalMatrix),
            snapGeometry: displayGeometry(
              this.profileGeometrySource,
              this.profileGeometryModel,
              'schematic',
            ).applyMatrix4(this.profileLocalMatrix),
          };
      if (this.drawingReflection) {
        variant.geometry.applyMatrix4(this.drawingReflection);
        variant.snapGeometry.applyMatrix4(this.drawingReflection);
        for (const entry of variant.entries || []) {
          entry.geometry.applyMatrix4(this.drawingReflection);
          entry.snapGeometry.applyMatrix4(this.drawingReflection);
        }
      }
      this.profileVariants.set(detail, variant);
    }
    return variant;
  }
  selectView(view) {
    this.annotations.selected = null;
    this.annotations.ui();
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
    this.profileDetailControl?.sync();
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
    this.viewPlacement?.sync();
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
        this.snapGeometry.applyMatrix4(this.drawingReflection);
        for (const e of this.assemblyEntries || []) {
          e.geometry.applyMatrix4(this.drawingReflection);
          e.snapGeometry.applyMatrix4(this.drawingReflection);
        }
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
    if (!this.assembly) {
      const settings = this.config.partMaterialSchedule;
      if (settings.dockToTop)
        settings.position = singlePartMaterialPosition(this.paper, this.frameLayout);
      const data = singlePartMaterialData(this.record, this.getAttributeState());
      appendSinglePartMaterialSchedule(this.svg, data, settings);
      for (const input of this.partMaterialPanel.querySelectorAll('input')) {
        const key = input.dataset.materialField;
        if (key === 'visible') input.checked = settings.visible;
        else input.value = settings.position[key === 'x' ? 0 : 1];
      }
      if (settings.visible && data && !data.verified)
        this.$('message').textContent =
          'Numrera om detaljerna för att uppdatera materiallistans antal och totaler.';
      if (
        settings.visible &&
        (settings.position[0] < 0 ||
          settings.position[1] < 0 ||
          settings.position[0] + singlePartMaterialSize[0] > w ||
          settings.position[1] + singlePartMaterialSize[1] > h)
      )
        this.$('message').textContent =
          'Materiallistan ligger utanför bladet. Ändra placering eller välj ett större format.';
    }
    if (this.assembly) {
      const schedule = this.config.assemblySchedule;
      const table = assemblyScheduleTable(
        assemblySchedule(this.assembly, this.getAttributeState()),
        schedule,
      );
      if (schedule.style === 'material' && schedule.dockToTitle)
        schedule.position = materialSchedulePosition(table, this.paper, this.frameLayout);
      this.paintAssemblySchedule();
      for (const input of this.assemblyPanel.querySelectorAll('input')) {
        const key = input.dataset.scheduleField;
        if (key === 'visible') input.checked = schedule.visible;
        else input.value = schedule.position[key === 'x' ? 0 : 1];
      }
      if (
        schedule.visible &&
        (schedule.position[0] < 0 ||
          schedule.position[0] + table.width > w ||
          schedule.position[1] - (schedule.style === 'material' ? 0 : table.rowHeight) < 0 ||
          schedule.position[1] +
            (schedule.style === 'material'
              ? materialScheduleHeight(table)
              : table.values.length * table.rowHeight) >
            h)
      )
        this.$('message').textContent =
          'Stycklistan ligger utanför bladet. Ändra placering under Stycklista eller välj ett större format.';
    }
    const selected = this.config.views.find((view) => view.id === this.selectedView);
    if (selected) {
      const handles = node('g', {
        'data-view': selected.id,
        class: 'drawing-view-grips-layer',
        transform: `translate(${selected.position})`,
      });
      appendDrawingViewGrips(handles, ...selected.size, this.navigation.scale);
      this.svg.append(handles);
    }
    const guides = [...this.svg.querySelectorAll('.section-extent-guides')];
    guides.forEach((n) => (n.style.display = 'none'));
    this.contentBounds = pasteboardBounds(this.paper, this.svg.getBBox());
    guides.forEach((n) => n.style.removeProperty('display'));
    this.size();
  }
  paintAssemblySchedule() {
    const settings = this.config.assemblySchedule;
    if (!settings?.visible) return;
    const table = assemblyScheduleTable(
        assemblySchedule(this.assembly, this.getAttributeState()),
        settings,
      ),
      [x, y] = settings.position,
      widths = table.columns.map((c) => c.width),
      height = table.rowHeight,
      g = node('g', {
        'data-assembly-schedule': this.assembly.id,
        transform: `translate(${x},${y})`,
        'font-size': table.settings.textSize,
      });
    if (table.settings.style === 'material') {
      appendMaterialSchedule(
        this.svg,
        table,
        this.assembly.id,
        drawingAssemblies(this.record, this.getAttributeState()).length,
      );
      return;
    }
    g.append(
      node(
        'text',
        { x: 0, y: -3, 'font-weight': 'bold' },
        `${this.assembly.mark} · ${drawingAssemblies(this.record, this.getAttributeState()).length} st assemblies · Stycklista per assembly`,
      ),
    );
    const values = table.values;
    values.forEach((row, i) => {
      let left = 0;
      row.forEach((value, j) => {
        g.append(
          node('rect', {
            x: left,
            y: i * height,
            width: widths[j],
            height,
            fill: i ? 'white' : '#eef3f2',
            stroke: '#899ba4',
            'stroke-width': 0.15,
          }),
        );
        const clipId = `assembly-cell-${i}-${j}`;
        const clip = node('clipPath', { id: clipId });
        clip.append(node('rect', { x: left + 1, y: i * height, width: widths[j] - 2, height }));
        g.append(
          clip,
          node(
            'text',
            {
              x: left + 1.5,
              y: i * height + height / 2 + table.settings.textSize * 0.35,
              'clip-path': `url(#${clipId})`,
            },
            value,
          ),
        );
        left += widths[j];
      });
    });
    this.svg.append(g);
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
