import { highlightReferenceParts } from './selection-highlight.js';
import { validateReferenceCRS } from '../coordinates/reference-frame.js';
import { withinWorkArea } from '../model/work-area.js';
import { ReferenceImport } from './reference-import.js';
import { renderReferenceList, renderReferencePlacement } from './reference-inspector.js';
import * as THREE from 'three';
import { createReferencePartSnapIndex } from './snap-part-index.js';
import { referenceCandidates } from './edge-index.js';
import { applyCADPlacement } from './cad-geometry.js';
import { dxfUnits } from '../frame-dxf.js';
import { decodeReference, emptyReferences } from './reference-state.js';
import { initialReferencePlacement, placementAngles } from './reference-placement.js';
import { applyLayerVisibility } from './cad-layers.js';
import { installLayerControls, renderLayerControls } from './layer-controls.js';
export class ReferenceModels {
  constructor({
    scene,
    inspector,
    fit,
    status,
    getObjects,
    convert,
    getProfiles,
    openProfileLibrary,
    onChange,
    onSelect,
    beforePlacementChange,
    onExtentChange,
    getCoordinates = () => null,
  }) {
    Object.assign(this, {
      scene,
      fit,
      status,
      onChange,
      onSelect,
      beforePlacementChange,
      onExtentChange,
      getCoordinates,
    });
    this.selectionMode = 'reference';
    this.models = [];
    this.folders = ['Standard'];
    this.collapsed = new Set();
    this.selectedId = null;
    this.selectedObject = null;
    this.selectedReferenceId = null;
    this.parts = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.id = 'references-tab';
    tab.dataset.inspectorTab = 'references';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', 'inspector-references');
    tab.setAttribute('aria-selected', 'false');
    tab.textContent = 'Referenser';
    document.querySelector('[role=tablist]').append(tab);
    this.panel = document.createElement('section');
    this.panel.id = 'inspector-references';
    this.panel.hidden = true;
    this.panel.setAttribute('role', 'tabpanel');
    this.panel.setAttribute('aria-labelledby', tab.id);
    document.getElementById('inspector-model').after(this.panel);
    tab.onclick = () => {
      inspector.finish();
      inspector.show('references');
    };
    this.panel.innerHTML = `
      <div class="reference-heading"><h2>Referensmodeller</h2><button type="button" data-new-group>+ Grupp</button></div>
      <div data-overview>
        <form data-group-form hidden><label>Gruppnamn<input data-group-name required maxlength="80"></label><button type="submit">Skapa</button><button type="button" data-group-cancel>Avbryt</button></form>
        <div class="reference-drop" data-drop role="group" aria-label="Importera referensfil">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12 2H5v16h11V6l-4-4v4h4M10 14V9m-3 3 3-3 3 3"/></svg>
          <span>Släpp IFC, DXF eller DWG här</span><button type="button" data-import>Välj fil</button>
        </div>
        <input type="search" data-search placeholder="Sök referensmodeller…" aria-label="Sök referensmodeller">
        <div data-list></div>
      </div>
      <input type="file" accept=".ifc,.dxf,.dwg" hidden>
      <button type="button" data-cancel hidden>Avbryt import</button><progress max="100" hidden aria-label="Referensimport"></progress><p role="status"></p>
      <div data-model hidden>
        <button type="button" data-back>← Alla referensmodeller</button>
        <h3 data-name></h3>
        <div class="reference-fields">
          <label>Namn<input data-title maxlength="200"></label>
          <label>Fil<span data-file></span></label>
          <label>Grupp<select data-folder></select></label>
          <label>Visa referens<input type="checkbox" data-visible checked></label>
          <label>Transparent<input type="checkbox" data-transparent></label>
        </div>
        <details data-cad-layers hidden open><summary>Lager <span data-layer-count></span></summary>
          <div class="reference-layer-actions"><button type="button" data-layers-all>Visa alla</button><button type="button" data-layers-none>Dölj alla</button></div>
          <input type="search" data-layer-search aria-label="Sök lager" placeholder="Sök lager…">
          <div class="reference-layer-list" data-layer-list role="group" aria-label="CAD-lager"></div>
        </details>
        <details data-cad-placement hidden open><summary>Placering av referens</summary><p>Förflyttning från filens ursprungliga läge.</p><div class="reference-fields" data-placement-fields>
          <label>Koordinater<select data-coordinate-mode aria-label="Referensens koordinater"><option value="map">Verkliga koordinater</option><option value="local">Lokala modellkoordinater</option></select></label><label>Enhet<select data-cad-unit></select></label>
          <label>X · mm<input type="number" step="any" data-offset-x></label>
          <label>Y · mm<input type="number" step="any" data-offset-y></label>
          <label>Z · mm<input type="number" step="any" data-offset-z></label>
          <label>Rot. X · °<input type="number" step="any" data-rotation-x></label>
          <label>Rot. Y · °<input type="number" step="any" data-rotation-y></label>
          <label>Rot. Z · °<input type="number" step="any" data-cad-rotation></label>
          <label>Skala<input type="number" min="0.000001" step="any" data-cad-scale></label>
        </div><div class="reference-placement-actions"><label><input type="checkbox" data-placement-locked> Lås placering</label><button type="button" data-placement-reset>Återställ importläge</button></div><p data-cad-info></p></details>
        <details open><summary>Snapping</summary><div class="reference-fields">
          <label>Hörn<input type="checkbox" data-corners checked></label>
          <label>Kanter<input type="checkbox" data-edges checked></label>
        </div></details>
        <button type="button" data-fit>Visa referensens utbredning</button>
        <p data-object-selection>Markera ett IFC-objekt i modellvyn.</p>
        <button type="button" data-convert disabled>Konvertera markerat IFC-objekt…</button>
        <div class="reference-toolbar"><button type="button" data-replace>Byt referensfil…</button><button type="button" data-remove>Ta bort</button></div>
      </div>
      `;
    const $ = (s) => this.panel.querySelector(s);
    this.$ = $;
    installLayerControls(this);
    $('[data-coordinate-mode]').onchange = () => {
      const model = this.selected();
      if (!model || model.locked) return;
      const mode = $('[data-coordinate-mode]').value;
      try {
        validateReferenceCRS(model.sourceCoordinates, mode, this.getCoordinates());
        this.beforePlacementChange?.();
        model.coordinateMode = mode;
        applyCADPlacement(model);
        this.changed();
        this.onExtentChange?.(model);
      } catch (error) {
        $('[data-coordinate-mode]').value = model.coordinateMode || 'map';
        this.message(error.message, true);
      }
    };
    $('[data-placement-locked]').onchange = () =>
      this.setLocked(this.selected(), $('[data-placement-locked]').checked);
    $('[data-placement-reset]').onclick = () => this.resetPlacement(this.selected());
    $('[data-cad-unit]').replaceChildren(
      ...dxfUnits.map((u) => new Option(u.name, String(u.factor))),
    );
    for (const [selector, field, axis] of [
      ['[data-offset-x]', 'offset', 0],
      ['[data-offset-y]', 'offset', 1],
      ['[data-offset-z]', 'offset', 2],
      ['[data-cad-rotation]', 'rotation'],
      ['[data-rotation-x]', 'rotationX'],
      ['[data-rotation-y]', 'rotationY'],
      ['[data-cad-scale]', 'scale'],
      ['[data-cad-unit]', 'unit'],
    ])
      $(selector).onchange = () => {
        const model = this.selected(),
          input = $(selector),
          value = Number(input.value);
        if (
          !model?.placement ||
          model.locked ||
          !input.value.trim() ||
          !Number.isFinite(value) ||
          (['scale', 'unit'].includes(field) && value <= 0)
        ) {
          if (model) this.showModel(model.id);
          return;
        }
        this.beforePlacementChange?.();
        if (field === 'unit') {
          model.unitFactor = value;
          model.unitKnown = true;
        } else if (field.startsWith('rotation')) {
          const angles = placementAngles(model.placement);
          angles[field === 'rotationX' ? 0 : field === 'rotationY' ? 1 : 2] = value;
          model.placement.quaternion = new THREE.Quaternion()
            .setFromEuler(new THREE.Euler(...angles.map(THREE.MathUtils.degToRad)))
            .toArray();
          model.placement.rotation = angles[2];
        } else if (field === 'offset') model.placement.offset[axis] = value;
        else model.placement[field] = value;
        applyCADPlacement(model);
        this.setWorkArea(this.workAreaBounds || null, true);
        if (field === 'unit') this.showModel(model.id);
        this.changed();
        this.onExtentChange?.(model);
      };
    if (getObjects && convert) {
      this.conversionEnabled = true;
      let conversion;
      this.openConversion = async () => {
        const selection = this.selectedObject;
        if (!selection) return;
        inspector.finish();
        try {
          conversion ||= import('./conversion-ui.js').then(({ installReferenceConversion }) =>
            installReferenceConversion({
              getObjects,
              getProfiles,
              openProfileLibrary,
              commit: convert,
            }),
          );
          const open = await conversion;
          const model = this.selected();
          if (model?.id === selection.modelId && this.selectedObject === selection)
            open(model, [selection.ifcId]);
        } catch (error) {
          this.message(error.message);
        }
      };
      $('[data-convert]').onclick = this.openConversion;
    } else $('[data-convert]').hidden = true;
    const pickFile = (replaceId = null) => {
      if ($('[data-import]').disabled) return;
      this.replaceId = replaceId;
      $('input[type=file]').click();
    };
    $('[data-import]').onclick = () => pickFile();
    $('[data-replace]').onclick = () => pickFile(this.selectedId);
    $('input[type=file]').onchange = () => {
      const file = $('input[type=file]').files[0];
      if (file) this.importFile(file, { replaceId: this.replaceId });
      $('input[type=file]').value = '';
    };
    const drop = $('[data-drop]');
    const drag = (event) => {
      if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
      event.preventDefault();
      const busy = $('[data-import]').disabled;
      event.dataTransfer.dropEffect = busy ? 'none' : 'copy';
      drop.classList.toggle('is-dragging', !busy);
    };
    drop.ondragenter = drop.ondragover = drag;
    drop.ondragleave = (event) => {
      if (!drop.contains(event.relatedTarget)) drop.classList.remove('is-dragging');
    };
    drop.ondrop = (event) => {
      event.preventDefault();
      drop.classList.remove('is-dragging');
      this.dropFiles(Array.from(event.dataTransfer?.files || []));
    };
    $('[data-cancel]').onclick = () => {
      this.cancel();
      this.message('Import avbruten.');
    };
    $('[data-remove]').onclick = () => this.remove();
    $('[data-back]').onclick = () => this.showList();
    $('[data-search]').oninput = () => this.renderList();
    $('[data-new-group]').onclick = () => {
      $('[data-group-form]').hidden = false;
      $('[data-group-name]').focus();
    };
    $('[data-group-cancel]').onclick = () => {
      $('[data-group-form]').hidden = true;
    };
    $('[data-group-form]').onsubmit = (event) => {
      event.preventDefault();
      const name = $('[data-group-name]').value.trim();
      if (!name) return;
      if (!this.folders.includes(name)) this.folders.push(name);
      this.changed();
      $('[data-group-form]').hidden = true;
      $('[data-group-name]').value = '';
      this.renderList();
    };
    $('[data-title]').oninput = () => {
      const model = this.selected();
      if (!model) return;
      model.title = $('[data-title]').value.trim() || model.fileName;
      $('[data-name]').textContent = model.title;
      this.changed();
    };
    $('[data-folder]').onchange = () => {
      const model = this.selected();
      if (model) model.folder = $('[data-folder]').value;
      this.changed();
    };
    $('[data-visible]').onchange = () => {
      const model = this.selected();
      if (model) this.setVisible([model], $('[data-visible]').checked);
    };
    $('[data-transparent]').onchange = () => {
      const model = this.selected();
      if (!model) return;
      model.transparent = $('[data-transparent]').checked;
      for (const p of model.parts) {
        p.mesh.material.transparent = model.transparent || p.opacity < 1 || !!p.mesh.material.map;
        p.mesh.material.opacity = model.transparent ? 0.3 : p.opacity;
        p.mesh.material.depthWrite = !p.mesh.material.transparent;
        p.mesh.material.needsUpdate = true;
      }
      this.changed();
    };
    for (const key of ['corners', 'edges'])
      $('[data-' + key + ']').onchange = () => {
        const model = this.selected();
        if (model) model[key] = $('[data-' + key + ']').checked;
        this.changed();
      };
    $('[data-fit]').onclick = () => {
      const model = this.selected();
      const bounds = model && this.modelBounds(model);
      if (bounds && !bounds.isEmpty()) fit(bounds);
    };
    this.renderList();
  }
  snapshot() {
    return {
      folders: [...this.folders],
      models: [
        ...this.models.map((m) => ({
          id: m.id,
          title: m.title,
          fileName: m.fileName,
          folder: m.folder,
          format: m.format || 'IFC',
          source: m.source,
          coordinateMode: m.coordinateMode || 'map',
          sourceCoordinates: m.sourceCoordinates || null,
          visible: m.group.visible,
          transparent: m.transparent,
          corners: m.corners,
          edges: m.edges,
          locked: !!m.locked,
          ...(m.layers ? { layerVisibility: { ...m.layerVisibility } } : {}),
          ...(m.placement
            ? {
                placement: structuredClone(m.placement),
                unitFactor: m.unitFactor,
                unitKnown: m.unitKnown,
              }
            : {}),
        })),
        ...(this.unloaded || []),
      ],
    };
  }
  validateCoordinates(coordinates) {
    for (const model of [...this.models, ...(this.unloaded || [])])
      validateReferenceCRS(model.sourceCoordinates, model.coordinateMode, coordinates);
  }
  setCoordinates(coordinates) {
    this.validateCoordinates(coordinates);
    this.clearPlacementPreview();
    for (const model of this.models) {
      model.projectCoordinates = coordinates;
      applyCADPlacement(model);
    }
    this.setWorkArea(this.workAreaBounds || null, true);
    this.models.forEach((model) => this.onExtentChange?.(model));
  }
  changed() {
    this.setWorkArea(this.workAreaBounds || null);
    if (!this.restoring) this.onChange?.(this.snapshot());
  }
  transformSelection() {
    const model = this.selected();
    return this.selectedReferenceId === model?.id &&
      !this.selectedObject &&
      model?.group.visible &&
      !model.locked &&
      !this.importSession?.worker &&
      !this.restoring &&
      !this.panel?.hidden &&
      !this.$('[data-model]').hidden
      ? model
      : null;
  }
  previewPlacement(id, placement) {
    const model = this.models.find((m) => m.id === id);
    if (!model || model.locked) return;
    this.clearPlacementPreview();
    this.placementPreview = { model, placement: model.placement };
    model.placement = structuredClone(placement);
    applyCADPlacement(model);
    this.updatePlacementFields(model);
    this.setWorkArea(this.workAreaBounds || null, true);
  }
  clearPlacementPreview() {
    if (!this.placementPreview) return;
    const { model, placement } = this.placementPreview;
    this.placementPreview = null;
    model.placement = placement;
    applyCADPlacement(model);
    this.updatePlacementFields(model);
    this.setWorkArea(this.workAreaBounds || null, true);
  }
  setPlacement(id, placement) {
    this.clearPlacementPreview();
    const model = this.models.find((m) => m.id === id);
    if (!model || model.locked) return;
    model.placement = structuredClone(placement);
    applyCADPlacement(model);
    this.updatePlacementFields(model);
    this.setWorkArea(this.workAreaBounds || null, true);
    this.changed();
    this.onExtentChange?.(model);
  }
  setLocked(model, locked) {
    if (!model) return;
    this.clearPlacementPreview();
    model.locked = locked;
    this.syncPlacementLock(model);
    this.changed();
    this.onSelect?.(model);
  }
  syncPlacementLock(model) {
    this.$('[data-placement-locked]').checked = !!model.locked;
    for (const input of this.$('[data-placement-fields]').querySelectorAll('input,select'))
      input.disabled = !!model.locked;
    this.$('[data-placement-reset]').disabled = !!model.locked;
  }
  resetPlacement(model) {
    if (!model || model.locked) return;
    this.beforePlacementChange?.();
    this.setPlacement(model.id, { ...initialReferencePlacement(), scale: model.placement.scale });
    this.message('Referensen återställd till importläge.');
  }
  setLayersVisible(model, names, visible) {
    if (!model?.layers) return;
    model.layerVisibility = {
      ...model.layerVisibility,
      ...Object.fromEntries(names.map((name) => [name, visible])),
    };
    applyLayerVisibility(model);
    this.setWorkArea(this.workAreaBounds || null, true);
    renderLayerControls(this, model);
    this.changed();
  }
  updatePlacementFields(model) {
    return renderReferencePlacement({ selectedId: this.selectedId, $: this.$ }, model);
  }
  applySettings(model, saved) {
    model.coordinateMode = saved.coordinateMode || 'map';
    model.projectCoordinates = this.getCoordinates?.();
    for (const key of ['title', 'folder', 'transparent', 'corners', 'edges'])
      model[key] = saved[key];
    model.group.visible = saved.visible;
    model.locked = !!saved.locked;
    model.layerVisibility = { ...saved.layerVisibility };
    applyLayerVisibility(model);
    if (model.placement) {
      model.placement = structuredClone(saved.placement || initialReferencePlacement());
      model.unitFactor = saved.unitFactor;
      model.unitKnown = saved.unitKnown;
      applyCADPlacement(model);
    }
    for (const p of model.parts) {
      p.mesh.material.transparent = model.transparent || p.opacity < 1 || !!p.mesh.material.map;
      p.mesh.material.opacity = model.transparent ? 0.3 : p.opacity;
      p.mesh.material.depthWrite = !p.mesh.material.transparent;
      p.mesh.material.needsUpdate = true;
    }
  }
  async restore(saved = emptyReferences()) {
    this.clearPlacementPreview();
    const version = (this.restoreVersion = (this.restoreVersion || 0) + 1);
    this.restoring = true;
    this.panel && (this.panel.inert = true);
    this.cancel();
    this.clearObjectSelection();
    this.unloaded = [];
    this.folders = [...saved.folders];
    for (const model of [...this.models]) {
      if (!saved.models.some((m) => m.id === model.id && m.source === model.source)) {
        this.dispose(model.parts);
        this.group.remove(model.group);
        this.models.splice(this.models.indexOf(model), 1);
      }
    }
    this.syncParts();
    this.showList();
    for (const entry of saved.models) {
      if (this.restoreVersion !== version) return;
      const existing = this.models.find((m) => m.id === entry.id);
      if (existing) this.applySettings(existing, entry);
      else {
        const ok = await new Promise((resolve) => {
          try {
            const bytes = decodeReference(entry.source);
            this.load(
              { name: entry.fileName, size: bytes.byteLength, arrayBuffer: async () => bytes },
              { saved: entry, onComplete: resolve },
            ).catch(() => resolve(false));
          } catch {
            resolve(false);
          }
        });
        if (this.restoreVersion !== version) return;
        if (!ok) this.unloaded.push(structuredClone(entry));
      }
    }
    this.restoring = false;
    this.setWorkArea(this.workAreaBounds || null, true);
    this.panel && (this.panel.inert = false);
    this.showList();
    this.message(
      this.unloaded.length
        ? `${this.unloaded.length} referenser kunde inte visas. Originalfilerna finns kvar i projektet.`
        : `${this.models.length} referenser återställda.`,
      !!this.unloaded.length,
    );
  }
  selected() {
    return this.models.find((model) => model.id === this.selectedId);
  }
  pickObject(raycaster) {
    const visible = this.models.filter(
      (model) =>
        this.group.visible && model.group.visible && !['DXF', 'DWG'].includes(model.format),
    );
    const meshes = visible.flatMap((model) =>
      model.parts.filter((part) => part.mesh.visible).map((part) => part.mesh),
    );
    const hit = raycaster
      .intersectObjects(meshes, false)
      .find(
        (hit) => !this.workAreaBounds || withinWorkArea(this.workAreaBounds, hit.point.toArray()),
      );
    if (!hit) return null;
    const model = visible.find((model) => model.parts.some((part) => part.mesh === hit.object));
    return { modelId: model.id, ifcId: hit.object.userData.ifcId };
  }
  pickReference(raycaster) {
    if (!this.group.visible) return null;
    const models = this.models.filter((m) => m.group.visible);
    const hit = raycaster
      .intersectObjects(
        models.flatMap((m) => m.parts.filter((p) => p.mesh.visible).map((p) => p.mesh)),
        false,
      )
      .find(
        (hit) => !this.workAreaBounds || withinWorkArea(this.workAreaBounds, hit.point.toArray()),
      );
    if (!hit) return null;
    const model = models.find((m) => m.parts.some((p) => p.mesh === hit.object));
    return {
      modelId: model.id,
      ifcId:
        this.selectionMode === 'object' && model.format === 'IFC'
          ? hit.object.userData.ifcId
          : null,
    };
  }
  setSelectionMode(mode) {
    if (!['reference', 'object'].includes(mode)) throw Error('Ogiltigt referensmarkeringsläge.');
    const modelId = this.selectedObject?.modelId || this.selectedReferenceId;
    this.selectionMode = mode;
    this.clearObjectSelection();
    if (mode === 'reference' && modelId) this.selectReference(modelId);
    this.onSelect?.();
  }
  clearObjectSelection() {
    highlightReferenceParts(this.parts, false);
    this.selectedObject = null;
    this.selectedReferenceId = null;
    this.syncObjectSelection();
  }
  selectReference(id) {
    this.clearObjectSelection();
    const model = this.models.find((model) => model.id === id);
    if (!model?.group.visible) return;
    this.selectedReferenceId = id;
    highlightReferenceParts(model.parts, true);
    this.showModel(id);
    this.message(`Referens markerad: ${model.title || model.id}`);
    this.onSelect?.(model);
  }
  selectObject(selection) {
    this.clearObjectSelection();
    const model = this.models.find((model) => model.id === selection.modelId);
    if (!model || !model.group.visible) return;
    const parts = model.parts.filter((part) => part.mesh.userData.ifcId === selection.ifcId);
    if (!parts.length) return;
    this.selectedObject = selection;
    highlightReferenceParts(parts, true);
    this.showModel(model.id);
    this.message(`IFC-objekt markerat: ${parts[0].mesh.userData.name || '#' + selection.ifcId}`);
  }
  syncObjectSelection() {
    const cad = ['DXF', 'DWG'].includes(this.selected()?.format);
    this.$('[data-convert]').hidden = cad || !this.conversionEnabled;
    const selected = this.selectedObject?.modelId === this.selectedId ? this.selectedObject : null;
    const part =
      selected &&
      this.parts.find(
        (part) =>
          part.mesh.userData.ifcId === selected.ifcId && this.selected()?.parts.includes(part),
      );
    this.$('[data-object-selection]').textContent = part
      ? `Markerat: ${part.mesh.userData.name || 'IFC-objekt'} · #${selected.ifcId}`
      : cad
        ? 'CAD-referensen används som ritningsunderlag med snapping.'
        : 'Markera ett IFC-objekt i modellvyn.';
    this.$('[data-convert]').disabled = !!this.importSession?.worker || !part;
  }
  showList() {
    this.clearObjectSelection();
    this.selectedId = null;
    this.$('[data-new-group]').hidden = false;
    this.$('[data-model]').hidden = true;
    this.$('[data-overview]').hidden = false;
    this.renderList();
    this.onSelect?.();
  }
  showModel(id) {
    if (id !== this.selectedId) {
      this.$('[data-layer-search]').value = '';
      this.$('[data-layer-list]').scrollTop = 0;
    }
    this.selectedId = id;
    const model = this.selected();
    if (!model) return this.showList();
    this.$('[data-new-group]').hidden = true;
    this.$('[data-overview]').hidden = true;
    this.$('[data-model]').hidden = false;
    this.$('[data-name]').textContent = model.title;
    this.$('[data-title]').value = model.title;
    this.$('[data-file]').textContent = model.fileName;
    this.$('[data-cad-placement]').hidden = !model.placement;
    this.$('[data-coordinate-mode]').value = model.coordinateMode || 'map';
    renderLayerControls(this, model);
    if (model.placement) {
      this.syncPlacementLock(model);
      this.updatePlacementFields(model);
      for (const selector of ['[data-cad-unit]', '[data-cad-scale]'])
        this.$(selector).closest('label').hidden = model.format === 'IFC';
      this.$('[data-cad-unit]').value = model.unitFactor;
      this.$('[data-cad-scale]').value = model.placement.scale;
      this.$('[data-cad-info]').textContent = [
        model.format !== 'IFC' && !model.unitKnown
          ? 'Enhet saknas i filen. Millimeter har antagits; kontrollera enheten.'
          : '',
        model.skipped?.length ? `Objekt utan stöd: ${model.skipped.join(', ')}.` : '',
      ]
        .filter(Boolean)
        .join(' ');
    }
    const select = this.$('[data-folder]');
    select.replaceChildren();
    for (const folder of this.folders) {
      const option = document.createElement('option');
      option.textContent = option.value = folder;
      select.append(option);
    }
    select.value = model.folder;
    for (const key of ['visible', 'transparent', 'corners', 'edges'])
      this.$('[data-' + key + ']').checked = key === 'visible' ? model.group.visible : model[key];
    this.syncObjectSelection();
    this.onSelect?.(model);
  }
  setVisible(models, visible) {
    if (
      !visible &&
      models.some(
        (model) => model.id === (this.selectedObject?.modelId || this.selectedReferenceId),
      )
    )
      this.clearObjectSelection();
    for (const model of models) model.group.visible = visible;
    this.renderList();
    this.changed();
    if (visible) models.forEach((model) => this.onExtentChange?.(model));
  }
  renderList() {
    return renderReferenceList({
      $: this.$,
      setVisible: this.setVisible.bind(this),
      models: this.models,
      folders: this.folders,
      collapsed: this.collapsed,
      showModel: this.selectReference.bind(this),
      toggleFolder: (folder) => {
        if (this.collapsed.has(folder)) this.collapsed.delete(folder);
        else this.collapsed.add(folder);
        this.renderList();
      },
    });
  }
  message(text, error = false) {
    this.$('[role=status]').textContent = error ? text : '';
    this.status(text);
  }
  bounds() {
    const bounds = new THREE.Box3();
    for (const model of this.models) if (model.group.visible) bounds.union(this.modelBounds(model));
    return bounds;
  }
  modelBounds(model) {
    const bounds = new THREE.Box3();
    model.group.updateWorldMatrix(true, true);
    for (const part of model.parts)
      if (!part.layer || model.layerVisibility?.[part.layer] !== false)
        bounds.union(new THREE.Box3().setFromObject(part.mesh));
    return bounds;
  }
  dispose(parts) {
    for (const p of parts) {
      p.mesh.geometry.dispose();
      p.mesh.material.map?.dispose();
      p.mesh.material.dispose();
    }
  }
  setWorkArea(bounds, force = false) {
    const signature = JSON.stringify([bounds?.min.toArray(), bounds?.max.toArray()]);
    if (!force && signature === this.workAreaSignature) return;
    this.workAreaSignature = signature;
    this.workAreaBounds = bounds;
    for (const model of this.models) {
      model.group.updateWorldMatrix(true, true);
      for (const part of model.parts) {
        const layerVisible = !part.layer || model.layerVisibility?.[part.layer] !== false;
        if (!part.mesh.geometry.boundingBox) part.mesh.geometry.computeBoundingBox();
        const box = part.mesh.geometry.boundingBox.clone().applyMatrix4(part.mesh.matrixWorld);
        part.mesh.visible = layerVisible && (!bounds || bounds.intersectsBox(box));
      }
    }
    if (this.selectedObject) {
      const model = this.models.find((m) => m.id === this.selectedObject.modelId);
      if (
        !model?.group.visible ||
        !model.parts.some(
          (p) => p.mesh.visible && p.mesh.userData.ifcId === this.selectedObject.ifcId,
        )
      )
        this.clearObjectSelection();
    }
  }
  syncParts() {
    for (const model of this.models)
      if (model.snapIndex?.parts !== model.parts)
        model.snapIndex = createReferencePartSnapIndex(model.parts, model.group);
    this.parts = this.models.flatMap((model) => model.parts);
    this.setWorkArea(this.workAreaBounds || null, true);
  }
  clear() {
    this.clearPlacementPreview();
    this.restoreVersion = (this.restoreVersion || 0) + 1;
    this.restoring = false;
    this.panel && (this.panel.inert = false);
    this.unloaded = [];
    this.cancel();
    this.clearObjectSelection();
    this.dispose(this.parts);
    this.models = [];
    this.parts = [];
    this.group.clear();
    this.selectedId = null;
    this.changed();
  }
  remove(id = this.selectedId) {
    this.clearPlacementPreview();
    if ((this.selectedObject?.modelId || this.selectedReferenceId) === id)
      this.clearObjectSelection();
    this.cancel();
    const model = this.models.find((m) => m.id === id);
    if (model) {
      this.dispose(model.parts);
      this.group.remove(model.group);
      this.models = this.models.filter((m) => m !== model);
      this.syncParts();
    }
    this.selectedId = null;
    this.showList();
    this.message('Referensen borttagen.');
    this.changed();
  }
  cancel() {
    this.importer().cancel();
  }
  busy(value) {
    this.$('[data-import]').disabled = value;
    this.$('[data-replace]').disabled = value;
    this.syncObjectSelection();
    if (value) this.$('[data-convert]').disabled = true;
    this.$('[data-cancel]').hidden = !value;
    this.$('progress').hidden = !value;
    this.$('[data-drop]').classList?.toggle('is-importing', value);
  }
  importFile(file, options) {
    if (this.$('[data-import]').disabled) return;
    if (!/\.(ifc|dxf|dwg)$/i.test(file.name)) {
      this.message('Välj en IFC-fil, DXF-fil eller DWG-fil.', true);
      return;
    }
    return this.load(file, options);
  }
  dropFiles(files) {
    if (this.$('[data-import]').disabled) return;
    if (files.length > 1) {
      this.message('Släpp en referensfil åt gången.', true);
      return;
    }
    if (files.length) return this.importFile(files[0]);
  }
  importer() {
    return (this.importSession ||= new ReferenceImport({
      getModels: () => this.models,
      commitModel: (model, previous, saved) => {
        model.projectCoordinates = this.getCoordinates?.();
        if (previous?.id === (this.selectedObject?.modelId || this.selectedReferenceId))
          this.clearObjectSelection();
        applyCADPlacement(model);
        applyLayerVisibility(model);
        if (saved) this.applySettings(model, saved);
        if (previous) {
          this.dispose(previous.parts);
          this.group.remove(previous.group);
          this.models.splice(this.models.indexOf(previous), 1, model);
        } else this.models.push(model);
        this.group.add(model.group);
        this.group.visible = true;
        this.syncParts();
        this.showModel(model.id);
        if (!saved) this.onExtentChange?.(model);
      },
      dispose: (parts) => this.dispose(parts),
      busy: (value) => this.busy(value),
      message: (text, error) => this.message(text, error),
      progress: (value) => {
        this.$('progress').value = value;
      },
      onSelect: (model) => this.onSelect?.(model),
      changed: () => this.changed(),
      fit: (bounds) => this.fit(bounds),
      bounds: () => this.bounds(),
    }));
  }
  async load(file, options) {
    return this.importer().load(file, options);
  }
  candidates(options) {
    if (!this.group.visible) return [];
    return this.models.flatMap((model) =>
      model.group.visible && (model.corners || model.edges)
        ? referenceCandidates(model.snapIndex?.query(options) || model.parts, {
            ...options,
            workArea: this.workAreaBounds,
            corners: model.corners,
            edges: model.edges,
            labelPrefix: model.format || 'IFC',
          })
        : [],
    );
  }
}
