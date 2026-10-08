import { createGAShell } from './drawing/ui/ga-shell.js';
import { drawingProfileDetail } from './profile-detail.js';
import { installDrawingProfileDetail } from './drawing-profile-detail.js';
import { geometryEdges } from './fasteners/edges.js';
import { drawingAttributeContext } from './drawing-attributes.js';
import { applyDrawingFont, drawingFont } from './drawing-preferences.js';
import { vectorDrawing, appendVectorDrawing } from './drawing-vector.js';
import { setDrawingViewScale } from './drawing-views.js';
import { DrawingDetailTool } from './drawing-detail-tool.js';
import { appendViewTitle } from './drawing-view-title.js';
import { detailSource } from './drawing-details.js';
import { sectionGridLines, sectionLevelLines } from './section-grid.js';
import { visibleGridEndpoints } from './grid-label-position.js';
import {
  DRAWING_GRID_BUBBLE_DIAMETER,
  MODEL_GRID_BUBBLE_DIAMETER,
  modelGridBubbleMetrics,
  gridBubbleMetrics,
} from './grid-bubble-size.js';
import { DrawingSectionTool } from './drawing-section-tool.js';
import { frameMatrix, sectionDrawing } from './drawing-sections.js';
import { sectionClipPlanes } from './section-extents.js';
import { GAViews } from './ga-views.js';
import { DrawingWorkspace, drawingEditorShell } from './drawing-workspace.js';
import {
  findDrawingLayout,
  layoutPicker,
  fillLayoutPicker,
  appendDrawingLayout,
} from './drawing-layout.js';
import { pointOnPart, partAnchor } from './drawing-part-anchor.js';
import { snapDrawingGrid, snapDrawingLines } from './drawing-grid-snap.js';
import { hiddenEdges } from './drawing-hidden-lines.js';
import { DrawingAnnotations } from './drawing-annotations.js';
import { GADrawingReferences } from './ga-drawing-references.js';
import { captureDrawingDefinitions, modelViewFrame } from './model-drawing-references.js';
import { referenceCandidates, gridReference, surfaceReference } from './annotation-references.js';
import { partStatus } from './part-marks.js';
import { actionButton, actionMenu } from './drawing-toolbar.js';
import { partMatrix } from './part-marks.js';
import * as THREE from 'three';
import { objectGeometry, displayGeometry, isPhysical } from './model-object.js';
import { partHoleSchedule, partHoleCandidates } from './fasteners/drawing.js';
import { roundProfile } from './round-profile.js';
import { GridLines } from './grid-lines.js';
import { sectionSegments, planHeights } from './plan-section.js';
const svgNS = 'http://www.w3.org/2000/svg';
export class PlanView {
  constructor({ getState, getSnapSettings = () => ({ polar: 45 }) }) {
    this.getSnapSettings = getSnapSettings;
    this.selectedParts = new Set();
    this.getState = getState;
    const shell = createGAShell();
    const { body, inspector } = shell;
    Object.assign(this, {
      dialog: shell.dialog,
      $: shell.$,
      host: shell.host,
      partViews: shell.partViews,
      info: shell.info,
      reviewButton: shell.reviewButton,
      paperWorkspace: shell.paperWorkspace,
      page: shell.page,
      stage: shell.stage,
      frameSVG: shell.frameSVG,
    });
    this.dialog.addEventListener('close', () => {
      this.drag = null;
      this.clear();
    });
    this.$('level').onchange = () => this.rebuild();
    for (const key of ['lower', 'cut', 'upper'])
      this.$(key).oninput = () => {
        clearTimeout(this.pending);
        this.pending = setTimeout(() => {
          if (this.dialog.open) this.rebuild();
        }, 120);
      };
    this.$('fit').onclick = () => this.navigation.fit(true);
    this.partViews.querySelector('select').onchange = () => this.rebuild(true);
    this.dialog.addEventListener('close', () => {
      this.captureSettings();
      this.saveRecord?.(this.record);
    });
    this.layoutSelect = layoutPicker(inspector, 'plan-frame-layout', (id) => {
      this.record.sheet ??= {};
      this.record.sheet.layoutId = id;
      this.refreshPaper(true);
    });
    const scaleLabel = document.createElement('label');
    scaleLabel.textContent = 'Vy · skala 1:';
    this.paperScale = document.createElement('input');
    this.paperScale.type = 'number';
    this.paperScale.min = '.1';
    this.paperScale.max = '10000';
    this.paperScale.step = 'any';
    scaleLabel.append(this.paperScale);
    inspector.append(scaleLabel);
    this.paperScale.onchange = () => {
      const n = +this.paperScale.value;
      if (!Number.isFinite(n) || n < 0.1 || n > 10000) return;
      this.record.sheet.viewScale = n;
      if (this.views?.active) {
        setDrawingViewScale(this.views.active, n);
      }
      this.refreshPaper();
    };
    const hiddenLabel = document.createElement('label');
    hiddenLabel.className = 'drawing-check';
    hiddenLabel.innerHTML = '<input id=plan-hidden-lines type=checkbox>Visa skymda kanter';
    inspector.append(hiddenLabel);
    this.$('hidden-lines').onchange = () => this.rebuild();
    this.profileDetailControl = installDrawingProfileDetail(inspector, {
      view: () => this.views?.active,
      drawingType: () => this.record?.type || 'GA',
      changed: (view) => {
        this.record.settings.profileDetail = view.settings.profileDetail;
        this.rebuild();
      },
    });
    const gridLabel = document.createElement('label');
    gridLabel.className = 'drawing-check';
    gridLabel.hidden = true;
    gridLabel.innerHTML = '<input id=plan-section-grid type=checkbox checked>Visa stomlinjer';
    inspector.append(gridLabel);
    this.$('section-grid').onchange = () => {
      if (this.views.active) {
        this.views.active.settings.showGrid = this.$('section-grid').checked;
        this.record.settings.showGrid = this.$('section-grid').checked;
        this.draw();
      }
    };
    const levelsLabel = document.createElement('label');
    levelsLabel.className = 'drawing-check';
    levelsLabel.hidden = true;
    levelsLabel.innerHTML = '<input id=plan-section-levels type=checkbox checked>Visa höjdlinjer';
    inspector.append(levelsLabel);
    this.$('section-levels').onchange = () => {
      if (this.views.active) {
        this.views.active.settings.showLevels = this.$('section-levels').checked;
        this.record.settings.showLevels = this.$('section-levels').checked;
        this.draw();
      }
    };
    const toolbar = this.dialog.querySelector('.plan-toolbar');
    toolbar.classList.add('drawing-commandbar');
    toolbar.setAttribute('aria-label', 'Ritningsverktyg');
    actionButton(this.$('fit'), 'fit', 'Visa allt');
    this.actionsMenu = actionMenu(toolbar, {
      label: 'Mer',
      items: [actionButton(this.reviewButton, 'check', 'Markera som aktuell')],
    });
    const fitPaper = actionButton(document.createElement('button'), 'fit', 'Visa blad');
    fitPaper.onclick = () => this.navigation.fit();
    toolbar.prepend(fitPaper);
    const existingTools = new Set(toolbar.children);
    this.annotations = new DrawingAnnotations({
      dialog: this.dialog,
      surface: this.host,
      toolbar,
      adapter: {
        cancelTools: () => this.cancelInteraction(),
        manualLeaders: true,
        visible: (item) => !this.views?.active || item.view === this.views.active.id,
        validAnchor: (item, p) =>
          pointOnPart(
            this.group.children.find((o) => o.isMesh && o.userData.sourceId === item.sourceId),
            p,
            this.heights.lower,
            this.heights.upper,
          ),
        gridSnap: (p) => this.snapReferenceLines(p),
        gridReference: (p) =>
          this.sectionSource()?.section ? null : gridReference(p, this.getState().grid),
        grid: () => this.getState().grid,
        redraw: () => this.draw(),
        pixelScale: () => 1,
        unit: () => (this.frameLayout ? this.paperZoom : 4),
        project: (p) => [
          ((p[0] - this.center.x) / this.span) * this.host.clientHeight + this.host.clientWidth / 2,
          this.host.clientHeight / 2 -
            ((p[1] - this.center.y) / this.span) * this.host.clientHeight,
        ],
        locate: (e) => {
          const r = this.host.getBoundingClientRect(),
            u = this.span / this.host.clientHeight;
          return {
            view: this.views?.active?.id || 'plan',
            point: [
              this.center.x + (e.clientX - r.left - r.width / 2) * u,
              this.center.y - (e.clientY - r.top - r.height / 2) * u,
            ],
          };
        },
        candidates: () => this.annotationCandidates || [],
        pick: (e, hit) => this.pickPart(hit.point),
        mark: (id) => {
          const state = this.getState(),
            s = state.objects.find((s) => s.id === id);
          return s
            ? partStatus(s, state.objects, state.parts).valid
              ? partStatus(s, state.objects, state.parts).mark
              : s.name || 'Detalj'
            : null;
        },
      },
    });
    this.markSelected = actionButton(
      document.createElement('button'),
      'leader',
      'Part marks på valda',
    );
    this.markSelected.disabled = true;
    this.markSelected.title = 'Klicka på en detalj i GA. Shift-klick väljer flera.';
    toolbar.insertBefore(this.markSelected, this.actionsMenu);
    this.markSelected.onclick = () => this.labelSelectedParts();
    drawingEditorShell({
      dialog: this.dialog,
      body,
      toolbar,
      tools: [...toolbar.children].filter((child) => !existingTools.has(child)),
      cancel: () => this.cancelInteraction(),
      save: () => {
        this.captureSettings();
        this.saveRecord?.(this.record);
      },
      annotations: () => this.annotations,
    });
    this.navigation = new DrawingWorkspace({
      workspace: this.paperWorkspace,
      stage: this.stage,
      paper: this.page,
      getPaper: () => [this.frameLayout.width, this.frameLayout.height],
      getBounds: () => this.paperBounds(),
      blocked: () => !!(this.drag || this.annotations.drag),
      onScale: (scale) => {
        this.paperZoom = scale;
        this.positionView();
        if (this.scene) this.draw();
      },
    });
    this.views = new GAViews(this, inspector, toolbar);
    this.references = new GADrawingReferences(this, inspector);
    this.sectionTool = new DrawingSectionTool({
      dialog: this.dialog,
      workspace: this.paperWorkspace,
      toolbar: this.dialog.querySelector('.sheet-tools'),
      inspector,
      adapter: {
        getSnapSettings: this.getSnapSettings,
        feedback: this.annotations,
        cancel: () => this.cancelInteraction(),
        views: () => this.record.sheet.views || [],
        selected: () => this.views.active,
        markers: (id) => this.references.markers('section', id),
        namingViews: () => this.references.namingViews(),
        locate: (e, id) => {
          if (id && id !== this.views.active.id) return null;
          if (!e.target.closest('.plan-canvas') && !id) return null;
          return this.annotations.location(e, id, true);
        },
        paperPoint: (e) => {
          const r = this.page.getBoundingClientRect();
          return [(e.clientX - r.left) / this.paperZoom, (e.clientY - r.top) / this.paperZoom];
        },
        redraw: () => this.draw(),
        commit: (view) => this.commitSection(view),
        update: (view) => this.updateSection(view),
      },
    });
    this.detailTool = new DrawingDetailTool({
      dialog: this.dialog,
      workspace: this.paperWorkspace,
      toolbar: this.dialog.querySelector('.sheet-tools'),
      inspector,
      adapter: {
        getSnapSettings: this.getSnapSettings,
        feedback: this.annotations,
        cancel: () => this.cancelInteraction(),
        views: () => this.record.sheet.views || [],
        selected: () => this.views.active,
        markers: (id) => this.references.markers('detail', id),
        namingViews: () => this.references.namingViews(),
        locate: (e, id) => {
          if (id && id !== this.views.active.id) return null;
          if (!e.target.closest('.plan-canvas') && !id) return null;
          return this.annotations.location(e, id, true);
        },
        paperPoint: (e) => {
          const r = this.page.getBoundingClientRect();
          return [(e.clientX - r.left) / this.paperZoom, (e.clientY - r.top) / this.paperZoom];
        },
        redraw: () => this.draw(),
        commit: (view) => {
          this.captureSettings();
          this.record.sheet.views.push(view);
          this.views.activate(view.id);
          this.views.refresh();
        },
        update: (view) => {
          this.views.activate(view.id);
          this.views.load(view);
          this.views.refresh();
        },
      },
    });
  }
  configure() {
    const single = this.record?.type === 'SP';
    this.partViews.hidden = !single;
    for (const id of ['level', 'lower', 'cut', 'upper']) this.$(id).parentElement.hidden = single;
    this.dialog.querySelector('.plan-legend').hidden = single;
    this.reviewButton.hidden = !this.record;
    this.actionsMenu.hidden = !this.record;
    this.dialog.querySelector('header strong').textContent = this.record
      ? `${this.record.number} · ${this.record.name}`
      : 'Planritning';
    this.info.textContent = single ? `Part mark ${this.record.mark}` : '';
  }
  openRecord(record, { save, review }) {
    this.selectedParts.clear();
    this.markSelected.disabled = true;
    this.views.reset();
    this.record = structuredClone(record);
    if (this.fontSelect) this.fontSelect.value = drawingFont(this.record);
    this.frameLayout = null;
    this.paperWorkspace.classList.remove('with-layout');
    this.page.style.cssText = '';
    this.host.style.cssText = '';
    this.frameSVG.replaceChildren();
    this.annotations.open(this.record);
    this.saveRecord = save;
    this.configure();
    this.partViews.querySelector('select').value = record.view || 'front';
    this.dialog.showModal();
    this.stage.style.width = this.paperWorkspace.clientWidth + 'px';
    this.stage.style.height = this.paperWorkspace.clientHeight + 'px';
    this.page.style.width = this.paperWorkspace.clientWidth + 'px';
    this.page.style.height = this.paperWorkspace.clientHeight + 'px';
    this.init();
    this.syncLevels(true);
    if (record.type === 'GA') {
      this.$('hidden-lines').checked = !!record.settings.hiddenLines;
      this.$('level').value = record.levelId;
      for (const k of ['lower', 'cut', 'upper']) this.$(k).value = record.settings[k];
    }
    this.reviewButton.onclick = () => {
      if (this.$('error').textContent) return;
      this.captureSettings();
      review(this.record);
    };
    this.rebuild(true);
    if (record.viewport) {
      this.center.fromArray(record.viewport.center);
      this.span = record.viewport.span;
      this.draw();
    }
    if (!this.record.sheet && this.record.drawingPreset?.layoutId)
      this.record.sheet = { layoutId: this.record.drawingPreset.layoutId };
    fillLayoutPicker(this.layoutSelect, this.record.sheet?.layoutId);
    this.refreshPaper(true);
    this.views.open();
  }
  cancelInteraction() {
    this.views?.actions.cancel();
    this.sectionTool?.cancel();
    this.detailTool?.cancel();
    this.navigation?.pan.cancel();
    if (this.drag?.crop) {
      Object.assign(this.views.active, this.drag.crop.view);
      this.views.load(this.views.active);
    }
    if (this.drag?.position) {
      this.record.sheet.viewPosition = [...this.drag.position];
      if (this.views?.active) this.views.active.position = [...this.drag.position];
    }
    const id = this.drag?.pointerId;
    this.drag = null;
    if (id !== undefined && this.host.hasPointerCapture(id)) this.host.releasePointerCapture(id);
    this.selectedParts.clear();
    this.markSelected.disabled = true;
    this.annotations.endDrag(true);
    this.annotations.selected = null;
    this.annotations.cancel();
    if (this.frameLayout) this.refreshPaper();
  }
  paperBounds() {
    const { width: w, height: h } = this.frameLayout,
      bounds = [0, 0, w, h];
    const views = this.record.sheet?.views || [
      { position: this.record.sheet.viewPosition || [10, 10], size: [w - 20, h - 20] },
    ];
    for (const view of views) {
      bounds[0] = Math.min(bounds[0], view.position[0] - 5);
      bounds[1] = Math.min(bounds[1], view.position[1] - 5);
      bounds[2] = Math.max(bounds[2], view.position[0] + view.size[0] + 5);
      bounds[3] = Math.max(bounds[3], view.position[1] + view.size[1] + 12);
    }
    return bounds;
  }
  positionView() {
    const { width: w, height: h } = this.frameLayout,
      p = this.record.sheet.viewPosition || [10, 10],
      size = this.views?.active?.size || [w - 20, h - 20],
      z = this.paperZoom;
    Object.assign(this.host.style, {
      position: 'absolute',
      left: p[0] * z + 'px',
      top: p[1] * z + 'px',
      width: size[0] * z + 'px',
      height: size[1] * z + 'px',
      minHeight: '0',
    });
    this.views?.position();
  }
  refreshPaper(fit = false) {
    const saved = findDrawingLayout(this.record?.sheet?.layoutId);
    this.frameLayout = saved || { width: 420, height: 297 };
    const layout = this.frameLayout;
    this.paperWorkspace.classList.add('with-layout');
    this.paperScale.parentElement.hidden = false;
    const w = layout.width,
      h = layout.height,
      vh = this.views?.active?.size[1] || Math.max(h - 20, 10);
    this.record.sheet ??= {};
    if (!Number.isFinite(this.record.sheet.viewScale) || this.record.sheet.viewScale <= 0)
      this.record.sheet.viewScale =
        Number.isFinite(this.span) && this.span > 0 ? this.span / vh : 50;
    this.paperScale.value = Number(this.record.sheet.viewScale.toFixed(4));
    this.span = vh * this.record.sheet.viewScale;
    this.frameSVG.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.frameSVG.replaceChildren();
    if (saved)
      appendDrawingLayout(
        this.frameSVG,
        saved,
        drawingAttributeContext(this.record, this.getState()),
      );
    if (fit) this.navigation.fit();
    else this.navigation.size();
  }
  captureSettings() {
    if (this.record && this.center) {
      this.record.view = this.partViews.querySelector('select').value;
      this.record.viewport = { center: this.center.toArray(), span: this.span };
    }
    if (this.record?.type === 'GA') {
      this.record.levelId = this.$('level').value;
      this.record.settings = {
        ...this.record.settings,
        ...Object.fromEntries(['lower', 'cut', 'upper'].map((k) => [k, Number(this.$(k).value)])),
        hiddenLines: this.$('hidden-lines').checked,
      };
    }
    this.views?.capture();
    if (this.record?.type === 'GA' && this.record.sheet?.views)
      captureDrawingDefinitions(this.record, this.getState().levels.items);
  }
  rebuildPart(fit) {
    this.clear();
    const s = this.getState().objects.find((s) => s.id === this.record.sourceId);
    if (!s) {
      this.$('error').textContent = 'Detaljen saknas.';
      return;
    }
    this.$('error').textContent = '';
    this.grid.group.visible = false;
    this.grid.overlay.hidden = true;
    try {
      const g = objectGeometry(
        s,
        this.getState().objects,
        drawingProfileDetail(this.views?.active, this.record.type),
      );
      g.applyMatrix4(partMatrix(s));
      const view = this.partViews.querySelector('select').value;
      if (view === 'front') g.rotateX(-Math.PI / 2);
      if (view === 'end')
        g.applyMatrix4(new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1));
      g.computeBoundingBox();
      this.bounds = g.boundingBox.clone();
      this.heights = { lower: this.bounds.min.z - 1, upper: this.bounds.max.z + 1 };
      const fill = new THREE.Mesh(
        g,
        new THREE.MeshBasicMaterial({
          color: 0xfbfcfc,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
        }),
      );
      this.group.add(fill);
      const edge = new THREE.LineSegments(
        geometryEdges(g, roundProfile(s) ? 5 : 1),
        new THREE.LineBasicMaterial({ color: 0x20343b }),
      );
      edge.renderOrder = 1;
      this.group.add(edge);
      if (fit) this.fit();
      this.draw();
    } catch (e) {
      this.$('error').textContent = e.message;
    }
  }
  init() {
    if (this.scene) return;
    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 50000000);
    this.camera.position.set(0, 0, 20000000);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);
    this.center = new THREE.Vector2();
    this.span = 15000;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.grid = new GridLines(this.scene, this.host);
    this.svg = document.createElementNS(svgNS, 'svg');
    this.svg.classList.add('plan-section-overlay');
    this.svg.setAttribute('aria-hidden', 'true');
    this.host.append(this.svg);
    this.observer = new ResizeObserver(() => {
      if (this.dialog.open) this.draw();
    });
    this.observer.observe(this.host);
    this.host.onpointerdown = (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.ga-view-grip')) {
        this.annotations.selected = null;
        this.annotations.ui();
        this.views.list();
      }
      e.preventDefault();
      this.host.setPointerCapture(e.pointerId);
      this.drag = {
        pointerId: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        shift: e.shiftKey,
        crop: this.views.startDrag(e),
        position: e.target.closest('[data-viewport-grip]')
          ? [...(this.record.sheet.viewPosition || [10, 10])]
          : null,
      };
    };
    this.host.onpointermove = (e) => {
      const d = this.drag;
      if (d?.crop) {
        this.views.crop(
          d.crop,
          (e.clientX - d.x) / this.paperZoom,
          (e.clientY - d.y) / this.paperZoom,
        );
        this.navigation.size();
        return;
      }
      if (!d?.position) return;
      this.record.sheet.viewPosition = [
        d.position[0] + (e.clientX - d.x) / this.paperZoom,
        d.position[1] + (e.clientY - d.y) / this.paperZoom,
      ];
      if (this.views.active) this.views.active.position = [...this.record.sheet.viewPosition];
      this.navigation.size();
    };
    this.host.onpointerup = (e) => {
      const d = this.drag;
      this.drag = null;
      if (this.host.hasPointerCapture(e.pointerId)) this.host.releasePointerCapture(e.pointerId);
      if (d && !d.position && !d.crop && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) {
        const hit = this.annotations.adapter.locate(e),
          id = this.pickPart(hit.point);
        if (!d.shift) this.selectedParts.clear();
        if (id) {
          if (d.shift && this.selectedParts.has(id)) this.selectedParts.delete(id);
          else this.selectedParts.add(id);
        }
        this.markSelected.disabled = !this.selectedParts.size;
        this.draw();
      }
    };
    this.host.onpointercancel = () => this.cancelInteraction();
  }
  syncLevels(initial = false) {
    const { levels } = this.getState(),
      active = initial ? levels.active : this.$('level').value;
    this.$('level').replaceChildren(
      ...levels.items.map((l) => new Option(`${l.name} · ${l.elevation} mm`, l.id)),
    );
    this.$('level').value = levels.items.some((l) => l.id === active) ? active : levels.active;
  }
  sync() {
    if (this.dialog.open) {
      this.syncLevels();
      this.rebuild();
    }
  }
  clear() {
    this.vectorCache = null;
    if (!this.group) return;
    for (const c of [...this.group.children]) {
      c.geometry.dispose();
      c.material.dispose();
      this.group.remove(c);
    }
    this.sections = [];
    this.svg?.replaceChildren();
  }
  rebuild(fit = false) {
    if (this.sectionSource()?.section) {
      this.rebuildSection();
      return;
    }
    if (this.record?.type === 'SP') {
      this.rebuildPart(fit);
      return;
    }
    this.grid.group.visible = this.record.settings.showGrid !== false;
    this.grid.overlay.hidden = !this.grid.group.visible;
    const state = this.getState(),
      level = state.levels.items.find((l) => l.id === this.$('level').value);
    let h;
    try {
      h = planHeights(
        level.elevation,
        ...['lower', 'cut', 'upper'].map((k) => {
          const value = this.$(k).value;
          return value.trim() ? Number(value) : NaN;
        }),
      );
    } catch (e) {
      this.$('error').textContent = e.message;
      return;
    }
    this.$('error').textContent = '';
    this.captureSettings();
    this.heights = h;
    this.clear();
    this.bounds = new THREE.Box3();
    this.annotationCandidates = [];
    const planes = (lo, hi) => [
      new THREE.Plane(new THREE.Vector3(0, 0, 1), -lo),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), hi),
    ];
    try {
      for (const s of state.objects.filter((s) => isPhysical(s))) {
        const detail = drawingProfileDetail(this.views?.active, this.record.type);
        const g = objectGeometry(s, this.getState().objects, detail);
        g.computeBoundingBox();
        const b = g.boundingBox;
        if (b.isEmpty() || b.max.z < h.lower || b.min.z > h.upper) {
          g.dispose();
          continue;
        }
        this.bounds.union(b);
        const edge = geometryEdges(g, roundProfile(s) ? 5 : 1);
        const fill = new THREE.Mesh(
          g,
          new THREE.MeshBasicMaterial({
            color: 0xfbfcfc,
            side: THREE.DoubleSide,
            clippingPlanes: planes(h.lower, h.cut),
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1,
          }),
        );
        fill.userData.sourceId = s.id;
        this.group.add(fill);
        const snapGeometry = displayGeometry(s, this.getState().objects, 'schematic'),
          snapEdges = geometryEdges(snapGeometry, roundProfile(s) ? 5 : 1),
          pos = snapEdges.attributes.position;
        const objectCandidates = [];
        const identities = [],
          localMatrix = partMatrix(s);
        for (let i = 0; i < pos.count; i += 2) {
          for (const t of [0, 0.5, 1]) {
            const z = pos.getZ(i) * (1 - t) + pos.getZ(i + 1) * t;
            if (z >= h.lower && z <= h.upper) {
              objectCandidates.push([
                pos.getX(i) * (1 - t) + pos.getX(i + 1) * t,
                pos.getY(i) * (1 - t) + pos.getY(i + 1) * t,
              ]);
              const p = objectCandidates.at(-1);
              identities.push(new THREE.Vector3(p[0], p[1], z).applyMatrix4(localMatrix).toArray());
            }
          }
        }
        this.annotationCandidates.push(...referenceCandidates(objectCandidates, s.id, identities));
        const schedule = partHoleSchedule(s, state.objects, new THREE.Matrix4()).filter(
          (hole) => hole.center[2] >= h.lower && hole.center[2] <= h.upper,
        );
        for (const hole of partHoleCandidates(schedule, {
          origin: [0, 0, 0],
          x: [1, 0, 0],
          y: [0, 1, 0],
          normal: [0, 0, 1],
        })) {
          hole.point.reference.source = s.id;
          this.annotationCandidates.push(hole.point);
        }
        snapEdges.dispose();
        snapGeometry.dispose();
        const lines = new THREE.LineSegments(
          edge,
          new THREE.LineBasicMaterial({ color: 0x53666d, clippingPlanes: planes(h.lower, h.cut) }),
        );
        lines.userData.sourceId = s.id;
        lines.renderOrder = 2;
        this.group.add(lines);
        if (this.$('hidden-lines').checked)
          this.group.add(
            hiddenEdges(edge.clone(), {
              dashSize: 100,
              gapSize: 60,
              clippingPlanes: planes(h.lower, h.cut),
            }),
          );
        const above = new THREE.LineSegments(
          edge.clone(),
          new THREE.LineDashedMaterial({
            color: 0x99a5ab,
            dashSize: 100,
            gapSize: 70,
            depthTest: false,
            clippingPlanes: planes(h.cut + 0.01, h.upper),
          }),
        );
        above.computeLineDistances();
        above.renderOrder = 2;
        this.group.add(above);
        this.sections.push(...sectionSegments(g, h.cut));
      }
      this.grid.set({ ...state.grid, z: h.cut });
      for (const line of this.grid.group.children) {
        line.material.depthTest = false;
        line.renderOrder = 3;
      }
      this.bounds.union(this.grid.bounds);
      if (fit) this.fit();
      this.draw();
    } catch (e) {
      this.clear();
      this.$('error').textContent = 'Planvyn kunde inte beräknas: ' + e.message;
      this.draw();
    }
  }
  sectionSource() {
    const view = this.views?.active;
    return view ? detailSource(view, this.record.sheet.views) : null;
  }
  sectionFrameFor(view) {
    return modelViewFrame(view, this.record.sheet.views, this.getState().levels.items);
  }
  sectionBounds(view) {
    const geometries = this.getState()
      .objects.filter((s) => isPhysical(s))
      .map((s) =>
        objectGeometry(s, this.getState().objects, drawingProfileDetail(view, this.record.type)),
      );
    try {
      return sectionDrawing(geometries, this.sectionFrameFor(view), view.section.depth).bounds;
    } finally {
      geometries.forEach((g) => g.dispose());
    }
  }
  commitSection(view) {
    this.captureSettings();
    this.record.sheet.views.push(view);
    const bounds = this.sectionBounds(view),
      size = bounds.getSize(new THREE.Vector2());
    view.camera.center = bounds.getCenter(new THREE.Vector2()).toArray();
    view.size = [Math.max(30, size.x / view.scale + 12), Math.max(30, size.y / view.scale + 12)];
    this.views.activate(view.id);
    this.sectionTool.sync();
    this.views.refresh();
  }
  updateSection(view) {
    const bounds = this.sectionBounds(view);
    view.camera.center = bounds.getCenter(new THREE.Vector2()).toArray();
    if (this.views.active.id === view.id) {
      this.views.load(view);
      this.rebuild();
    } else {
      this.draw();
      this.views.activate(view.id);
    }
    this.views.list();
    this.navigation.size();
    this.views.refresh();
  }
  rebuildSection() {
    const view = this.views.active,
      depth = this.sectionSource().section.depth;
    this.captureSettings();
    this.clear();
    this.grid.group.visible = false;
    this.grid.overlay.hidden = true;
    this.annotationCandidates = [];
    this.heights = { lower: -depth, upper: 0 };
    this.bounds = new THREE.Box3();
    const frame = this.sectionFrameFor(view),
      matrix = frameMatrix(frame),
      planes = sectionClipPlanes(frame, depth);
    for (const object of this.getState().objects.filter((s) => isPhysical(s))) {
      const detail = drawingProfileDetail(view, this.record.type);
      const g = objectGeometry(object, this.getState().objects, detail).applyMatrix4(matrix);
      g.computeBoundingBox();
      if (g.boundingBox.max.z < -depth || g.boundingBox.min.z > 0) {
        g.dispose();
        continue;
      }
      this.bounds.union(g.boundingBox);
      const mesh = new THREE.Mesh(
        g,
        new THREE.MeshBasicMaterial({
          color: 0xfbfcfc,
          side: THREE.DoubleSide,
          clippingPlanes: planes,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
        }),
      );
      mesh.userData.sourceId = object.id;
      this.group.add(mesh);
      const edges = geometryEdges(g, roundProfile(object) ? 5 : 1),
        lines = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: 0x53666d, clippingPlanes: planes }),
        );
      lines.userData.sourceId = object.id;
      lines.renderOrder = 2;
      this.group.add(lines);
      if (view.settings.hiddenLines)
        this.group.add(
          hiddenEdges(edges.clone(), {
            dashSize: 2 * view.scale,
            gapSize: view.scale,
            clippingPlanes: planes,
          }),
        );
      const snapData = sectionDrawing(
        [g],
        { origin: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], normal: [0, 0, 1], span: frame.span },
        depth,
      );
      this.sections.push(...snapData.cut);
      const snapGeometry = displayGeometry(
        object,
        this.getState().objects,
        'schematic',
      ).applyMatrix4(matrix);
      const candidates = sectionDrawing(
        [snapGeometry],
        { origin: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], normal: [0, 0, 1], span: frame.span },
        depth,
      );
      snapGeometry.dispose();
      this.annotationCandidates.push(
        ...referenceCandidates(
          [...candidates.cut, ...candidates.behind].flatMap(([a, b]) => [
            a,
            b,
            [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
          ]),
          object.id,
        ),
      );
    }
    this.$('error').textContent = this.group.children.length
      ? ''
      : 'Snittet träffar inga objekt inom valt djup.';
    this.draw();
  }
  pickPart(point) {
    const ray = new THREE.Raycaster(
      new THREE.Vector3(point[0], point[1], this.heights.upper + 1),
      new THREE.Vector3(0, 0, -1),
    );
    const hit = ray
      .intersectObjects(
        this.group.children.filter((o) => o.isMesh),
        false,
      )
      .find((h) => h.point.z >= this.heights.lower && h.point.z <= this.heights.upper);
    return hit?.object.userData.sourceId || null;
  }
  pickAnnotation(point) {
    const id = this.pickPart(point),
      state = this.getState(),
      s = state.objects.find((s) => s.id === id);
    return s && partStatus(s, state.objects, state.parts).valid ? s.id : null;
  }
  labelSelectedParts() {
    const meshes = this.group.children.filter(
      (o) => o.isMesh && this.selectedParts.has(o.userData.sourceId),
    );
    if (!meshes.length) return;
    this.annotations.checkpoint();
    const offset = this.span / this.host.clientHeight;
    let i = 0;
    for (const mesh of meshes) {
      const point = partAnchor(mesh, this.heights.lower, this.heights.upper),
        id = mesh.userData.sourceId;
      if (!point) continue;
      if (
        this.annotations.items.some(
          (a) =>
            a.type === 'leader' &&
            !a.manual &&
            a.sourceId === id &&
            a.view === (this.views?.active?.id || 'plan'),
        )
      )
        continue;
      this.annotations.items.push({
        id: crypto.randomUUID(),
        type: 'leader',
        sourceId: id,
        view: this.views?.active?.id || 'plan',
        points: [point],
        references: [surfaceReference(point, id, this.annotationCandidates)],
        line: [point[0] + 60 * offset, point[1] + (40 + i++ * 24) * offset],
      });
    }
    this.annotations.cancel();
  }
  fit() {
    if (!this.bounds || this.bounds.isEmpty()) return;
    const size = this.bounds.getSize(new THREE.Vector3()),
      center = this.bounds.getCenter(new THREE.Vector3()),
      aspect = Math.max(1, this.host.clientWidth) / Math.max(1, this.host.clientHeight);
    this.center.set(center.x, center.y);
    this.span = Math.max(size.y, size.x / aspect, 1000) * 1.15;
  }
  snapReferenceLines(point) {
    const tolerance = (10 * this.span) / this.host.clientHeight;
    if (!this.sectionSource()?.section)
      return snapDrawingGrid(point, this.getState().grid, tolerance);
    const view = this.views.active,
      width = (this.span * this.host.clientWidth) / this.host.clientHeight,
      bounds = [
        this.center.x - width / 2,
        this.center.y - this.span / 2,
        this.center.x + width / 2,
        this.center.y + this.span / 2,
      ],
      frame = this.sectionFrameFor(view),
      state = this.getState(),
      lines = [];
    if (view.settings.showGrid !== false)
      lines.push(...sectionGridLines(state.grid, frame, bounds));
    if (view.settings.showLevels !== false)
      lines.push(...sectionLevelLines(state.levels.items, frame, bounds));
    return snapDrawingLines(
      point,
      lines.map((l) => l.points),
      tolerance,
    );
  }
  drawSectionGrid(root, w, h) {
    const view = this.views?.active;
    if (!this.sectionSource()?.section || view.settings.showGrid === false) return;
    const width = (this.span * w) / h,
      bounds = [
        this.center.x - width / 2,
        this.center.y - this.span / 2,
        this.center.x + width / 2,
        this.center.y + this.span / 2,
      ];
    const layer = document.createElementNS(svgNS, 'g');
    layer.setAttribute('class', 'section-grid');
    layer.setAttribute('pointer-events', 'none');
    root.append(layer);
    const append = (tag, attrs, text) => {
      const node = document.createElementNS(svgNS, tag);
      for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
      if (text) node.textContent = text;
      layer.append(node);
    };
    for (const line of sectionGridLines(this.getState().grid, this.sectionFrameFor(view), bounds)) {
      const points = line.points.map((p) => this.annotations.adapter.project(p));
      append('path', {
        d: `M${points[0]}L${points[1]}`,
        stroke: '#82969f',
        'stroke-width': 1,
        'stroke-dasharray': '7 4',
        fill: 'none',
      });
      const metrics = this.frameLayout
          ? gridBubbleMetrics(line.label, DRAWING_GRID_BUBBLE_DIAMETER * this.paperZoom)
          : modelGridBubbleMetrics(line.label, (MODEL_GRID_BUBBLE_DIAMETER * h) / this.span),
        radius = metrics.radius,
        ends = visibleGridEndpoints(points[0], points[1], w, h, radius + metrics.inset);
      if (!ends) continue;
      ends.forEach((p, index) => {
        if (index && Math.hypot(p[0] - ends[0][0], p[1] - ends[0][1]) < radius * 2 + metrics.inset)
          return;
        append(this.frameLayout ? 'ellipse' : 'rect', {
          ...(this.frameLayout
            ? { cx: p[0], cy: p[1], rx: radius, ry: metrics.height / 2 }
            : {
                x: p[0] - radius,
                y: p[1] - metrics.height / 2,
                width: radius * 2,
                height: metrics.height,
                rx: metrics.height / 2,
                ry: metrics.height / 2,
              }),
          fill: '#edf3f5',
          stroke: '#718995',
          'stroke-width': metrics.strokeWidth,
        });
        append(
          'text',
          {
            x: p[0],
            y: p[1],
            'text-anchor': 'middle',
            'dominant-baseline': 'central',
            'font-size': metrics.fontSize,
            'font-family': 'Arial, sans-serif',
            fill: '#425d69',
          },
          line.label,
        );
      });
    }
  }
  drawSectionLevels(root, w, h) {
    const view = this.views?.active;
    if (!this.sectionSource()?.section || view.settings.showLevels === false) return;
    const width = (this.span * w) / h,
      bounds = [
        this.center.x - width / 2,
        this.center.y - this.span / 2,
        this.center.x + width / 2,
        this.center.y + this.span / 2,
      ],
      layer = document.createElementNS(svgNS, 'g');
    layer.setAttribute('class', 'section-levels');
    layer.setAttribute('pointer-events', 'none');
    root.append(layer);
    const append = (tag, attrs, text) => {
      const node = document.createElementNS(svgNS, tag);
      for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
      if (text) node.textContent = text;
      layer.append(node);
      return node;
    };
    for (const level of sectionLevelLines(
      this.getState().levels.items,
      this.sectionFrameFor(view),
      bounds,
    )) {
      const [a, b] = level.points.map((p) => this.annotations.adapter.project(p)),
        left = a[0] <= b[0] ? a : b;
      append('path', {
        d: `M${a}L${b}`,
        stroke: '#758e9b',
        'stroke-width': 1,
        'stroke-dasharray': '10 4 2 4',
        fill: 'none',
      });
      const x = Math.max(7, Math.min(w - 7, left[0] + 7)),
        y = left[1];
      append('path', { d: `M${x},${y}l5,-5h-10Z`, fill: '#758e9b' });
      const label =
        level.name +
        ' · ' +
        (level.elevation >= 0 ? '+' : '') +
        level.elevation.toLocaleString('sv-SE') +
        ' mm';
      append(
        'text',
        {
          x: Math.max(7, Math.min(w - 10, left[0] + 16)),
          y: Math.max(13, Math.min(h - 5, y - 7)),
          'font-size': 11,
          'font-family': 'Arial, sans-serif',
          fill: '#425d69',
          stroke: 'white',
          'stroke-width': 3,
          'paint-order': 'stroke',
        },
        label,
      );
    }
  }
  draw() {
    applyDrawingFont(this.page, this.record);
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    const width = (this.span * w) / h;
    Object.assign(this.camera, {
      left: -width / 2,
      right: width / 2,
      top: this.span / 2,
      bottom: -this.span / 2,
    });
    if (this.heights) {
      this.camera.position.z = this.heights.upper + 10000;
      this.camera.far = this.heights.upper - this.heights.lower + 20000;
    }
    this.camera.position.x = this.center.x;
    this.camera.position.y = this.center.y;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    for (const o of this.group.children)
      if (o.isMesh)
        o.material.color.set(this.selectedParts.has(o.userData.sourceId) ? '#d7eee4' : '#fbfcfc');
    if (!this.vectorCache) {
      const surfaces = this.group.children
        .filter((o) => o.isMesh)
        .map((o) => ({ geometry: o.geometry, planes: o.material.clippingPlanes || [] }));
      const edgeSets = this.group.children
        .filter((o) => o.isLineSegments && o.material.depthFunc !== THREE.GreaterDepth)
        .map((o) => ({
          geometry: o.geometry,
          planes: o.material.clippingPlanes || [],
          dashed: !!o.material.isLineDashedMaterial,
          overlay: o.material.depthTest === false,
          color: '#' + o.material.color.getHexString(),
          sourceId: o.userData.sourceId,
        }));
      this.vectorCache = vectorDrawing(surfaces, edgeSets);
    }
    this.grid.updateLabels(this.camera, w, h, {
      keepVisible: true,
      diameter: this.frameLayout ? DRAWING_GRID_BUBBLE_DIAMETER * this.paperZoom : undefined,
    });
    this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute(
      'd',
      (this.sections || [])
        .map(
          ([a, b]) =>
            `M${((a[0] - this.center.x) / this.span) * h + w / 2},${h / 2 - ((a[1] - this.center.y) / this.span) * h}L${((b[0] - this.center.x) / this.span) * h + w / 2},${h / 2 - ((b[1] - this.center.y) / this.span) * h}`,
        )
        .join(''),
    );
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#20343b');
    path.setAttribute('stroke-width', '2');
    const defs = document.createElementNS(svgNS, 'defs'),
      clip = document.createElementNS(svgNS, 'clipPath'),
      rect = document.createElementNS(svgNS, 'rect');
    clip.id = 'ga-active-crop';
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    clip.append(rect);
    defs.append(clip);
    const content = document.createElementNS(svgNS, 'g');
    content.setAttribute('clip-path', 'url(#ga-active-crop)');
    const project = (p) => [
      ((p[0] - this.center.x) / this.span) * h + w / 2,
      h / 2 - ((p[1] - this.center.y) / this.span) * h,
    ];
    appendVectorDrawing(
      content,
      this.vectorCache.map((set) =>
        this.selectedParts.has(set.sourceId) ? { ...set, color: '#16815e' } : set,
      ),
      project,
      {
        hidden: this.$('hidden-lines').checked,
        width: 0.18 * this.paperZoom,
        dash: 2 * this.paperZoom,
        gap: this.paperZoom,
      },
    );
    if (this.grid.group.visible) {
      const gridLines = this.grid.group.children.map((line) => ({
        geometry: line.geometry,
        overlay: true,
        dashed: true,
        color: '#82969f',
      }));
      appendVectorDrawing(content, vectorDrawing([], gridLines), project, {
        width: 0.15 * this.paperZoom,
        dash: 4 * this.paperZoom,
        gap: 2 * this.paperZoom,
      });
    }
    content.append(path);
    this.svg.replaceChildren(defs, content);
    this.drawSectionGrid(content, w, h);
    this.drawSectionLevels(content, w, h);
    this.annotations.render(content);
    if (this.views?.active) {
      this.references.sync();
      this.sectionTool?.paint(
        content,
        this.views.active.id,
        (p) => this.annotations.adapter.project(p),
        this.paperZoom,
      );
      this.detailTool?.paint(
        content,
        this.views.active.id,
        (p) => this.annotations.adapter.project(p),
        this.paperZoom,
      );
      appendViewTitle(this.svg, this.views.active, this.paperZoom, h, this.paperZoom);
    }
  }
}
