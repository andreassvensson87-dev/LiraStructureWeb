import { createViewCropPreview } from './drawing-view-crop-preview.js';
import { bindInspectorField, setInspectorFieldState } from './inspector/field-state.js';
import { buildPlanObjects, buildSectionObjects } from './plan-view-geometry.js';
import { paintPlanView, paintSectionGrid, paintSectionLevels } from './plan-view-renderer.js';
import { updateScreenGrips } from './ui/grip.js';
import { beginDrawingViewGrip } from './drawing-view-grip-editor.js';

import { createGAShell } from './drawing/ui/ga-shell.js';
import { drawingProfileDetail } from './profile-detail.js';
import { installDrawingProfileDetail } from './drawing-profile-detail.js';
import { geometryEdges } from './fasteners/edges.js';
import { drawingAttributeContext } from './drawing-attributes.js';
import { applyDrawingFont, drawingFont } from './drawing-preferences.js';
import { projectedDrawing } from './drawing-vector.js';
import { setDrawingViewScale } from './drawing-views.js';
import { DrawingDetailTool } from './drawing-detail-tool.js';

import { detailSource } from './drawing-details.js';
import { sectionGridLines, sectionLevelLines } from './section-grid.js';

import { DRAWING_GRID_BUBBLE_DIAMETER } from './grid-bubble-size.js';
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

import { DrawingAnnotations } from './drawing-annotations.js';
import { GADrawingReferences } from './ga-drawing-references.js';
import { DrawingIFCReferences } from './drawing-ifc-references.js';
import { drawingReferenceSnapIndex } from './references/drawing-reference-geometry.js';
import { captureDrawingDefinitions, modelViewFrame } from './model-drawing-references.js';
import { gridReference, surfaceReference } from './annotation-references.js';
import { partStatus } from './part-marks.js';
import { actionButton, actionMenu } from './drawing-toolbar.js';
import { partMatrix } from './part-marks.js';
import * as THREE from 'three';
import { objectGeometry, isPhysical } from './model-object.js';

import { roundProfile } from './round-profile.js';
import { GridLines } from './grid-lines.js';
import { planHeights } from './plan-section.js';

const svgNS = 'http://www.w3.org/2000/svg';
export class PlanView {
  constructor({
    getState,
    getSnapSettings = () => ({ polar: 45 }),
    openDrawingList = () => {},
    getReferenceModels = () => [],
  }) {
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
      clearTimeout(this.pending);
      this.pending = null;
      this.annotations?.grips?.cancel();
      this.drag = null;
      this.clear();
    });
    this.$('level').onchange = () => this.rebuild();
    for (const key of ['lower', 'cut', 'upper'])
      this.$(key).oninput = () => {
        for (const name of ['lower', 'cut', 'upper']) this.$(name).setCustomValidity('');
        clearTimeout(this.pending);
        this.pending = setTimeout(() => {
          if (this.dialog.open) this.rebuild();
        }, 120);
      };
    this.heightFieldStates = ['lower', 'cut', 'upper'].map((key) =>
      bindInspectorField(this.$(key), () => this.record?.settings[key] ?? this.$(key).value),
    );
    this.$('fit').onclick = () => this.navigation.fit(true);
    const hatchLabel = document.createElement('label');
    hatchLabel.textContent = 'Visa materialhatchning';
    this.hatchControl = document.createElement('input');
    this.hatchControl.type = 'checkbox';
    this.hatchControl.checked = true;
    hatchLabel.append(this.hatchControl);
    inspector.append(hatchLabel);
    this.hatchControl.onchange = () => {
      this.record.settings.materialHatch = this.hatchControl.checked;
      for (const view of this.views?.selectedViews() || [])
        view.settings.materialHatch = this.hatchControl.checked;
      this.draw();
      this.views?.refresh();
    };
    this.partViews.querySelector('select').onchange = () => this.rebuild(true);
    this.dialog.addEventListener('close', () => {
      this.captureSettings();
      this.saveRecord?.(this.record);
      this.views?.reset();
      this.frameSVG.replaceChildren();
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
      if (!this.views?.selectedViews().length) return;
      this.captureSettings();
      for (const view of this.views.selectedViews()) setDrawingViewScale(view, n);
      this.views.load(this.views.active);
      this.views.refresh();
      this.refreshPaper();
      this.views.list();
    };
    bindInspectorField(this.paperScale, () => {
      const views = this.views?.selectedViews() || [];
      return views.length && views.every((v) => v.scale === views[0].scale) ? views[0].scale : '';
    });
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
    fitPaper.dataset.drawingCommandGroup = 'display';
    this.$('fit').dataset.drawingCommandGroup = 'display';
    this.reviewButton.dataset.drawingCommandGroup = 'document';
    const existingTools = new Set(toolbar.children);
    this.annotations = new DrawingAnnotations({
      dialog: this.dialog,
      surface: this.host,
      toolbar,
      adapter: {
        paper: this.page,
        paperSize: () => [this.frameLayout.width, this.frameLayout.height],
        beginViewGrip: (event, node) => {
          const preview = createViewCropPreview({
            host: this.annotations.overlayHost,
            paper: this.annotations.adapter.paper,
            paperSize: this.annotations.adapter.paperSize,
          });
          const session = beginDrawingViewGrip({
            preview: (view) => preview.paint(view),
            clearPreview: () => preview.remove(),
            event,
            node,
            paper: this.page,
            paperSize: () => [this.frameLayout.width, this.frameLayout.height],
            views: () => this.views.items,
            selected: () => this.views.selectedViews(),
            annotations: this.annotations,
            render: () => {
              this.record.sheet.viewPosition = [...this.views.active.position];
              if (node.dataset.cropCorner) {
                this.views.load(this.views.active);
                this.positionView();
                this.draw();
              } else this.views.position();
              this.navigation.size();
            },
          });
          if (!session) preview.remove();
          return session;
        },
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
        project: (p, view) =>
          view === 'paper'
            ? [
                p[0] * this.paperZoom +
                  this.page.getBoundingClientRect().left -
                  this.host.getBoundingClientRect().left,
                p[1] * this.paperZoom +
                  this.page.getBoundingClientRect().top -
                  this.host.getBoundingClientRect().top,
              ]
            : [
                ((p[0] - this.center.x) / this.span) * this.host.clientHeight +
                  this.host.clientWidth / 2,
                this.host.clientHeight / 2 -
                  ((p[1] - this.center.y) / this.span) * this.host.clientHeight,
              ],
        locate: (e, view) => {
          if (view === 'paper') {
            const rect = this.page.getBoundingClientRect();
            return {
              view,
              point: [
                ((e.clientX - rect.left) * this.frameLayout.width) / rect.width,
                ((e.clientY - rect.top) * this.frameLayout.height) / rect.height,
              ],
            };
          }
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
        candidates: (view, point, tolerance) =>
          view === 'paper' && this.views?.active
            ? (this.annotationCandidates || []).map((p) =>
                Object.assign(
                  [
                    this.views.active.position[0] +
                      this.views.active.size[0] / 2 +
                      (p[0] - this.views.active.camera.center[0]) / this.views.active.scale,
                    this.views.active.position[1] +
                      this.views.active.size[1] / 2 -
                      (p[1] - this.views.active.camera.center[1]) / this.views.active.scale,
                  ],
                  { reference: p.reference, snapKind: p.snapKind },
                ),
              )
            : [...(this.annotationCandidates || []), ...this.referenceCandidates(point, tolerance)],
        snapEntities: (view, point, tolerance) =>
          view === 'paper'
            ? []
            : [
                ...(this.sections || []),
                ...(this.vectorCache || [])
                  .filter((set) => !set.referenceId)
                  .flatMap((set) => set.visible || []),
                ...(point ? this.referenceSnapQuery?.(point, tolerance) || [] : []),
              ].map((points) => ({ type: 'line', points: points.map((p) => p.slice(0, 2)) })),
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
      openList: openDrawingList,
      save: () => {
        this.captureSettings();
        this.saveRecord?.(this.record);
      },
      annotations: () => this.annotations,
    });
    this.navigation = new DrawingWorkspace({
      completion: {
        getCommand: () => this.annotations.completionCommand(),
        complete: () => this.annotations.complete(),
      },
      workspace: this.paperWorkspace,
      stage: this.stage,
      paper: this.page,
      getPaper: () => [this.frameLayout.width, this.frameLayout.height],
      getBounds: () => this.paperBounds(),
      blocked: () => !!(this.drag || this.annotations.drag || this.annotations.grips?.session),
      onScale: (scale) => {
        this.paperZoom = scale;
        this.positionView();
        if (this.scene) this.draw();
        updateScreenGrips(this.dialog);
      },
    });
    this.views = new GAViews(this, inspector, toolbar);
    this.references = new GADrawingReferences(this, inspector);
    this.ifcReferences = new DrawingIFCReferences(this, inspector, getReferenceModels);
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
        selected: () => (this.views.selected ? this.views.active : null),
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
        update: (view, options) => this.updateSection(view, options),
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
        selected: () => (this.views.selected ? this.views.active : null),
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
        update: (view) => this.views.refreshChanged(view.id),
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
    this.annotations?.grips?.cancel();
    this.views?.marquee.cancel();
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
      for (const original of this.drag.positions) {
        const view = this.views.items.find((view) => view.id === original.id);
        if (view) view.position = [...original.position];
      }
      this.views.position();
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
    this.annotations?.richText?.paint(this.frameSVG);
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
      const grip = e.target.closest('.ga-view-grip,.ga-viewport-grip,.ga-crop-grip');
      const partPick =
        e.shiftKey && !grip && this.pickPart(this.annotations.adapter.locate(e).point);
      this.views.activate(this.views.active.id, e.shiftKey && !partPick, !!grip || !!partPick);
      if (e.shiftKey && !partPick) return;
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
        positions: this.views
          .selectedViews()
          .map((view) => ({ id: view.id, position: [...view.position] })),
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
      for (const original of d.positions) {
        const view = this.views.items.find((view) => view.id === original.id);
        view.position = [
          original.position[0] + (e.clientX - d.x) / this.paperZoom,
          original.position[1] + (e.clientY - d.y) / this.paperZoom,
        ];
      }
      this.views.position();
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
    this.modelFaces = null;
    this.referenceSnapQuery = null;
    this.annotationCandidates = [];
    if (!this.group) return;
    for (const c of [...this.group.children]) {
      c.geometry.dispose();
      c.material.dispose();
      this.group.remove(c);
    }
    this.sections = [];
    this.hatchSurfaces = [];
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
      for (const key of ['lower', 'cut', 'upper']) {
        const input = this.$(key);
        if (Number(input.value) !== this.record.settings[key] || !input.value.trim()) {
          input.setCustomValidity(e.message);
          setInspectorFieldState(input, { changed: true, invalid: true });
        }
      }
      return;
    }
    this.$('error').textContent = '';
    this.captureSettings();
    this.heightFieldStates.forEach((sync) => sync());
    this.heights = h;
    this.clear();
    this.bounds = new THREE.Box3();
    this.annotationCandidates = [];
    const planes = (lo, hi) => [
      new THREE.Plane(new THREE.Vector3(0, 0, 1), -lo),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), hi),
    ];
    try {
      buildPlanObjects({
        bounds: this.bounds,
        group: this.group,
        annotationCandidates: this.annotationCandidates,
        sections: this.sections,
        hatchSurfaces: this.hatchSurfaces,
        objects: state.objects,
        detail: drawingProfileDetail(this.views?.active, this.record.type),
        hiddenLines: this.$('hidden-lines').checked,
        h: h,
        planes: planes,
      });
      this.ifcReferences.add({ heights: h, planes: planes(h.lower, h.cut) });
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
  referenceCandidates(point, tolerance) {
    if (!point) return [];
    return (this.referenceSnapQuery?.(point, tolerance) || []).flatMap(([a, b]) => [
      Object.assign([...a], { snapKind: 'Ändpunkt' }),
      Object.assign([...b], { snapKind: 'Ändpunkt' }),
      Object.assign([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], { snapKind: 'Mittpunkt' }),
    ]);
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
      const frame = this.sectionFrameFor(view);
      return sectionDrawing(geometries, frame, view.section.depth).bounds.union(
        this.ifcReferences.sectionBounds(
          view,
          frameMatrix(frame),
          sectionClipPlanes(frame, view.section.depth),
        ),
      );
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
  updateSection(view, { recenter = true } = {}) {
    if (recenter) {
      const bounds = this.sectionBounds(view);
      view.camera.center = bounds.getCenter(new THREE.Vector2()).toArray();
    }
    this.views.refreshChanged(view.id);
    this.sectionTool.sync();
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
    buildSectionObjects({
      bounds: this.bounds,
      group: this.group,
      sections: this.sections,
      hatchSurfaces: this.hatchSurfaces,
      annotationCandidates: this.annotationCandidates,
      objects: this.getState().objects,
      detail: drawingProfileDetail(view, this.record.type),
      hiddenLines: view.settings.hiddenLines,
      scale: view.scale,
      depth: depth,
      matrix: matrix,
      planes: planes,
      frame: frame,
    });
    this.ifcReferences.add({ matrix, heights: { lower: -depth, cut: 0, upper: 0 }, planes });
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
        this.group.children.filter((o) => o.isMesh && !o.userData.referenceId),
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
    return paintSectionGrid(
      {
        views: this.views,
        sectionSource: this.sectionSource.bind(this),
        span: this.span,
        center: this.center,
        getState: this.getState,
        sectionFrameFor: this.sectionFrameFor.bind(this),
        annotations: this.annotations,
        frameLayout: this.frameLayout,
        paperZoom: this.paperZoom,
      },
      root,
      w,
      h,
    );
  }
  drawSectionLevels(root, w, h) {
    return paintSectionLevels(
      {
        views: this.views,
        sectionSource: this.sectionSource.bind(this),
        span: this.span,
        center: this.center,
        getState: this.getState,
        sectionFrameFor: this.sectionFrameFor.bind(this),
        annotations: this.annotations,
      },
      root,
      w,
      h,
    );
  }
  draw() {
    this.host.classList.toggle(
      'object-grip-focused',
      !!(this.annotations?.selected || this.annotations?.mode),
    );
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
          referenceId: o.userData.referenceId,
          referenceSnap: o.userData.referenceSnap,
          showHidden: o.userData.showHidden,
        }));
      const projection = edgeSets.some((set) => set.referenceId)
        ? this.ifcReferences.projection(surfaces, edgeSets)
        : projectedDrawing(surfaces, edgeSets);
      this.vectorCache = projection?.edges || [];
      this.modelFaces = projection?.faces || [];
      this.referenceSnapQuery = drawingReferenceSnapIndex(this.vectorCache);
    }
    this.grid.updateLabels(this.camera, w, h, {
      keepVisible: true,
      diameter: this.frameLayout ? DRAWING_GRID_BUBBLE_DIAMETER * this.paperZoom : undefined,
    });

    return paintPlanView({
      svg: this.svg,
      sections: this.sections,
      center: this.center,
      span: this.span,
      annotations: this.annotations,
      modelFaces: this.modelFaces,
      record: this.record,
      hatchSurfaces: this.hatchSurfaces,
      paperZoom: this.paperZoom,
      vectorCache: this.vectorCache,
      selectedParts: this.selectedParts,
      $: this.$,
      grid: this.grid,
      drawSectionGrid: this.drawSectionGrid.bind(this),
      drawSectionLevels: this.drawSectionLevels.bind(this),
      frameSVG: this.frameSVG,
      views: this.views,
      references: this.references,
      sectionTool: this.sectionTool,
      detailTool: this.detailTool,
      w: this.host.clientWidth,
      h: this.host.clientHeight,
    });
  }
}
