import { packDrawingProjection, unpackDrawingProjection } from './drawing-projection-result.js';
import * as THREE from 'three';
import { projectedDrawing } from './drawing-vector.js';
import { drawingProjectionData } from './drawing-projection-data.js';
import { createEditorSection } from './ui/editor-surface.js';
import {
  drawingReferenceGeometry,
  drawingReferenceOptions,
  drawingReferenceSectionBounds,
} from './references/drawing-reference-geometry.js';

/** GA-specific visibility; the model reference controller keeps import and placement. */
export class DrawingIFCReferences {
  constructor(editor, inspector, getModels) {
    this.editor = editor;
    this.getModels = getModels;
    this.projections = new Map();
    this.pending = new Map();
    this.viewKeys = new Map();
    this.versions = new WeakMap();
    this.nextVersion = 0;
    this.panel = document.createElement('section');
    this.panel.className = 'drawing-ifc-panel';
    inspector.append(this.panel);
    editor.dialog.addEventListener('close', () => {
      this.worker?.terminate();
      this.worker = null;
      this.pending.forEach((job) => job.finish());
      this.pending.clear();
      this.projections.clear();
      this.activeProjection = null;
      this.viewKeys.clear();
      this.error = null;
    });
  }
  store(key, result, viewId) {
    const previous = this.viewKeys.get(viewId);
    if (previous && previous !== key) this.projections.delete(previous);
    this.viewKeys.set(viewId, key);
    this.projections.set(key, result);
  }
  pruneViews() {
    const views = this.editor.record?.sheet?.views;
    if (!views) return;
    const ids = new Set(views.map((view) => view.id));
    for (const [id, key] of this.viewKeys)
      if (!ids.has(id)) {
        this.projections.delete(key);
        this.viewKeys.delete(id);
      }
    for (const [key, job] of this.pending)
      if (!ids.has(job.viewId)) {
        this.pending.delete(key);
        job.finish();
      }
    if (
      this.activeProjection &&
      (!this.projections.has(this.activeProjection.key) ||
        this.activeProjection.key !== this.viewKeys.get(this.editor.views?.active?.id))
    )
      this.activeProjection = null;
  }
  async ready() {
    while (this.pending.size)
      await Promise.all([...this.pending.values()].map((job) => job.promise));
    if (this.error) throw Error(this.error);
  }
  fail(message) {
    this.error = `IFC-vyn kunde inte beräknas: ${message}`;
    this.worker?.terminate();
    this.worker = null;
    this.pending.forEach((job) => job.finish());
    this.pending.clear();
    this.editor.$('error').textContent = this.error;
    this.render();
  }
  projection(surfaces, edgeSets) {
    const e = this.editor;
    const version = (value) => {
      if (!this.versions.has(value)) this.versions.set(value, ++this.nextVersion);
      return this.versions.get(value);
    };
    const key = JSON.stringify([
      version(e.getState().objects),
      e.record.id,
      e.views.active?.id,
      e.heights,
      e.record.settings,
      e.center.toArray(),
      e.views.active?.size,
      e.views.active?.scale,
      e.sectionSource()?.section,
      this.getModels().map((model) => [
        version(model),
        model.placement,
        drawingReferenceOptions(e.views.active?.settings, model.id),
      ]),
    ]);
    if (this.projections.has(key)) {
      const cached = this.projections.get(key);
      this.projections.delete(key);
      this.projections.set(key, cached);
      if (this.activeProjection?.key !== key) {
        // Release the previous view before allocating the next decoded result.
        this.activeProjection = null;
        this.activeProjection = { key, result: unpackDrawingProjection(cached) };
      }
      return this.activeProjection.result;
    }
    if (typeof Worker !== 'undefined') {
      if (this.pending.has(key) || this.error) return null;
      if (!this.worker) {
        this.worker = new Worker(new URL('./drawing-projection.worker.js', import.meta.url), {
          type: 'module',
        });
        this.worker.onmessage = ({ data }) => {
          const job = this.pending.get(data.key);
          if (!job) return;
          if (data.error) {
            this.fail(data.error);
            return;
          }
          this.store(data.key, data.result, job.viewId);
          this.pending.delete(data.key);
          job.finish();
          if (!this.pending.size && e.dialog.open) {
            // Rebuild snapshots only after the batch is complete, preserving the active view.
            e.views.refresh();
            this.render();
          }
        };
        this.worker.onerror = (event) =>
          this.fail(event.message || 'Bakgrundsberäkningen avbröts.');
      }
      const job = { viewId: e.views.active?.id };
      job.promise = new Promise((resolve) => {
        job.finish = resolve;
      });
      this.pending.set(key, job);
      const payload = drawingProjectionData(surfaces, edgeSets);
      this.worker.postMessage({ key, data: payload.data }, payload.buffers);
      this.render();
      return null;
    }
    const result = projectedDrawing(surfaces, edgeSets);
    this.store(key, packDrawingProjection(result), e.views.active?.id);
    this.activeProjection = { key, result };
    return result;
  }
  change(id, key, value) {
    const e = this.editor;
    e.captureSettings();
    const settings = e.views.active.settings;
    settings.ifcReferences = {
      ...settings.ifcReferences,
      [id]: {
        ...drawingReferenceOptions(settings, id),
        [key]: value,
      },
    };
    e.record.settings = { ...settings };
    e.views.refresh();
    this.render();
  }
  render() {
    this.pruneViews();
    const e = this.editor,
      view = e.views?.active;
    if (!view) return;
    const models = (e.getState().references?.models || []).filter(
      (model) => model.format === 'IFC',
    );
    const loaded = new Set(this.getModels().map((model) => model.id));
    this.panel.replaceChildren();
    const title = document.createElement('h3');
    title.textContent = 'Referenser i vyn';
    const note = document.createElement('p');
    note.className = 'drawing-reference-note';
    note.textContent = view.name;
    this.panel.append(title, note);
    if (this.pending.size || this.error) {
      const status = document.createElement('p');
      status.className = 'drawing-reference-note';
      status.setAttribute('role', 'status');
      status.textContent = this.error || 'Beräknar referensvyer…';
      this.panel.append(status);
    }
    if (!models.length) {
      note.textContent =
        'Importera IFC-referenser i modelläget. De kan sedan visas i den här GA-vyn.';
      return;
    }
    if (!models.some((model) => model.id === this.selected)) this.selected = models[0].id;
    const list = document.createElement('div');
    list.className = 'drawing-reference-list';
    this.panel.append(list);
    for (const model of models) {
      const options = drawingReferenceOptions(view.settings, model.id);
      const row = document.createElement('div');
      row.className = 'drawing-reference-row';
      row.setAttribute('aria-current', String(model.id === this.selected));
      const visible = document.createElement('input');
      visible.type = 'checkbox';
      visible.checked = options.visible;
      visible.setAttribute('aria-label', `Visa ${model.title} i ${view.name}`);
      visible.onchange = () => this.change(model.id, 'visible', visible.checked);
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = model.title;
      button.title = model.fileName;
      button.onclick = () => {
        this.selected = model.id;
        this.render();
      };
      row.append(visible, button);
      list.append(row);
    }
    const selected = models.find((model) => model.id === this.selected),
      options = drawingReferenceOptions(view.settings, selected.id);
    const fields = [];
    for (const [key, label] of [
      ['hiddenLines', 'Visa skymda kanter'],
      ['snap', 'Snappa till referensen'],
    ]) {
      const row = document.createElement('label');
      row.className = 'drawing-check';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = options[key];
      input.onchange = () => this.change(selected.id, key, input.checked);
      row.append(input, document.createTextNode(label));
      fields.push(row);
    }
    const filter = document.createElement('p');
    filter.className = 'drawing-reference-note';
    filter.textContent = 'Objektfilter · kommer senare';
    fields.push(filter);
    if (!loaded.has(selected.id)) {
      const warning = document.createElement('p');
      warning.textContent =
        'Referensen är inte laddad. Återgå till modellen och kontrollera importen.';
      warning.setAttribute('role', 'status');
      fields.push(warning);
    }
    this.panel.append(createEditorSection(selected.title, fields));
  }
  add({ matrix = new THREE.Matrix4(), heights, planes }) {
    const e = this.editor,
      view = e.views.active;
    const crop = view && [
      e.center.x - (view.size[0] * view.scale) / 2,
      e.center.y - (view.size[1] * view.scale) / 2,
      e.center.x + (view.size[0] * view.scale) / 2,
      e.center.y + (view.size[1] * view.scale) / 2,
    ];
    const parts = drawingReferenceGeometry(this.getModels(), view?.settings, {
      matrix,
      heights,
      crop,
    });
    for (const part of parts) {
      const tags = {
        referenceId: part.referenceId,
        referenceSnap: part.options.snap,
        showHidden: part.options.hiddenLines,
      };
      const mesh = new THREE.Mesh(
        part.geometry,
        new THREE.MeshBasicMaterial({ clippingPlanes: planes, side: THREE.DoubleSide }),
      );
      Object.assign(mesh.userData, tags);
      const lines = new THREE.LineSegments(
        part.edges,
        new THREE.LineBasicMaterial({ color: '#9aa7ad', clippingPlanes: planes }),
      );
      Object.assign(lines.userData, tags);
      e.group.add(mesh, lines);
      if (heights.upper > heights.cut) {
        const above = new THREE.LineSegments(
          part.edges.clone(),
          new THREE.LineDashedMaterial({
            color: '#9aa7ad',
            depthTest: false,
            dashSize: 100,
            gapSize: 70,
            clippingPlanes: [
              new THREE.Plane(new THREE.Vector3(0, 0, 1), -heights.cut - 0.01),
              new THREE.Plane(new THREE.Vector3(0, 0, -1), heights.upper),
            ],
          }),
        );
        Object.assign(above.userData, tags);
        above.computeLineDistances();
        e.group.add(above);
      }
      if (part.cut.length) {
        const geometry = new THREE.BufferGeometry().setFromPoints(
          part.cut.flatMap((pair) => pair.map((p) => new THREE.Vector3(p[0], p[1], heights.cut))),
        );
        const cut = new THREE.LineSegments(
          geometry,
          new THREE.LineBasicMaterial({ color: '#73878e', depthTest: false }),
        );
        Object.assign(cut.userData, tags);
        e.group.add(cut);
      }
      e.bounds.union(part.bounds);
    }
    this.render();
  }
  sectionBounds(view, matrix, planes) {
    return drawingReferenceSectionBounds(this.getModels(), view.settings, {
      matrix,
      depth: view.section.depth,
      planes,
    });
  }
}
