import * as THREE from 'three';
import { edgeIndex, referenceCandidates } from './edge-index.js';
import { installReferenceConversion } from './conversion-ui.js';
import { cadReferenceParts, applyCADPlacement } from './cad-geometry.js';
import { dxfUnits } from '../frame-dxf.js';
import { encodeReference, decodeReference, emptyReferences } from './reference-state.js';
import { initialReferencePlacement, placementAngles } from './reference-placement.js';
import { applyLayerVisibility, cadLayers } from './cad-layers.js';
import { installLayerControls, renderLayerControls } from './layer-controls.js';
export class ReferenceModels {
  constructor({
    scene,
    inspector,
    fit,
    status,
    getObjects,
    convert,
    onChange,
    onSelect,
    beforePlacementChange,
  }) {
    Object.assign(this, { scene, fit, status, onChange, onSelect, beforePlacementChange });
    this.models = [];
    this.folders = ['Standard'];
    this.collapsed = new Set();
    this.selectedId = null;
    this.selectedObject = null;
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
          <label>Enhet<select data-cad-unit></select></label>
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
        if (field === 'unit') this.showModel(model.id);
        this.changed();
      };
    if (getObjects && convert) {
      this.conversionEnabled = true;
      const openConversion = installReferenceConversion({ getObjects, commit: convert });
      $('[data-convert]').onclick = () => {
        const model = this.selected();
        if (model && this.selectedObject?.modelId === model.id) {
          inspector.finish();
          openConversion(model, [this.selectedObject.ifcId]);
        }
      };
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
  changed() {
    if (!this.restoring) this.onChange?.(this.snapshot());
  }
  transformSelection() {
    const model = this.selected();
    return model?.group.visible &&
      !model.locked &&
      !this.worker &&
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
  }
  clearPlacementPreview() {
    if (!this.placementPreview) return;
    const { model, placement } = this.placementPreview;
    this.placementPreview = null;
    model.placement = placement;
    applyCADPlacement(model);
    this.updatePlacementFields(model);
  }
  setPlacement(id, placement) {
    this.clearPlacementPreview();
    const model = this.models.find((m) => m.id === id);
    if (!model || model.locked) return;
    model.placement = structuredClone(placement);
    applyCADPlacement(model);
    this.updatePlacementFields(model);
    this.changed();
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
    renderLayerControls(this, model);
    this.changed();
  }
  updatePlacementFields(model) {
    if (this.selectedId !== model.id) return;
    const display = (value) => Math.round(value * 1000) / 1000;
    for (const [axis, key] of ['x', 'y', 'z'].entries())
      this.$('[data-offset-' + key + ']').value = display(model.placement.offset[axis]);
    const angles = placementAngles(model.placement);
    for (const [i, selector] of [
      '[data-rotation-x]',
      '[data-rotation-y]',
      '[data-cad-rotation]',
    ].entries())
      this.$(selector).value = display(angles[i]);
  }
  applySettings(model, saved) {
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
    const meshes = visible.flatMap((model) => model.parts.map((part) => part.mesh));
    const hit = raycaster.intersectObjects(meshes, false)[0];
    if (!hit) return null;
    const model = visible.find((model) => model.parts.some((part) => part.mesh === hit.object));
    return { modelId: model.id, ifcId: hit.object.userData.ifcId };
  }
  pickReference(raycaster) {
    if (!this.group.visible) return null;
    const models = this.models.filter((m) => m.group.visible);
    const hit = raycaster.intersectObjects(
      models.flatMap((m) => m.parts.filter((p) => p.mesh.visible).map((p) => p.mesh)),
      false,
    )[0];
    if (!hit) return null;
    const model = models.find((m) => m.parts.some((p) => p.mesh === hit.object));
    return { modelId: model.id, ifcId: hit.object.userData.ifcId };
  }
  clearObjectSelection() {
    for (const part of this.parts)
      if (part.selectionEmissive) {
        part.mesh.material.emissive.copy(part.selectionEmissive);
        delete part.selectionEmissive;
      }
    this.selectedObject = null;
    this.syncObjectSelection();
  }
  selectObject(selection) {
    this.clearObjectSelection();
    const model = this.models.find((model) => model.id === selection.modelId);
    if (!model || !model.group.visible) return;
    const parts = model.parts.filter((part) => part.mesh.userData.ifcId === selection.ifcId);
    if (!parts.length) return;
    this.selectedObject = selection;
    for (const part of parts) {
      part.selectionEmissive = part.mesh.material.emissive.clone();
      part.mesh.material.emissive.setHex(0x176b53);
    }
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
    this.$('[data-convert]').disabled = !!this.worker || !part;
  }
  showList() {
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
    if (!visible && models.some((model) => model.id === this.selectedObject?.modelId))
      this.clearObjectSelection();
    for (const model of models) model.group.visible = visible;
    this.renderList();
    this.changed();
  }
  renderList() {
    const list = this.$('[data-list]');
    list.replaceChildren();
    const query = this.$('[data-search]').value.trim().toLocaleLowerCase('sv');
    const button = (label, text, action, className) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.className = className;
      b.setAttribute('aria-label', label);
      b.onclick = action;
      return b;
    };
    const visibility = (models, label) => {
      const visible = models.some((m) => m.group.visible);
      const b = button(
        `${visible ? 'Dölj' : 'Visa'} ${label}`,
        '',
        () => this.setVisible(models, !visible),
        'reference-eye',
      );
      b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>${visible ? '' : '<path d="M3 21 21 3"/>'}</svg>`;
      b.setAttribute('aria-pressed', String(visible));
      b.disabled = !models.length;
      return b;
    };
    const all = document.createElement('div');
    all.className = 'reference-list-row reference-all';
    all.append(
      visibility(this.models, 'alla referenser'),
      document.createTextNode(`Alla (${this.models.length})`),
    );
    list.append(all);
    for (const folder of this.folders) {
      const members = this.models.filter((m) => m.folder === folder);
      const filtered = members.filter((m) =>
        `${m.title} ${m.fileName} ${folder}`.toLocaleLowerCase('sv').includes(query),
      );
      if (query && !filtered.length) continue;
      const section = document.createElement('div');
      const row = document.createElement('div');
      row.className = 'reference-list-row reference-group-row';
      const open = !!query || !this.collapsed.has(folder);
      const toggle = button(
        `${open ? 'Fäll ihop' : 'Visa grupp'} ${folder}`,
        open ? '▾' : '▸',
        () => {
          if (this.collapsed.has(folder)) this.collapsed.delete(folder);
          else this.collapsed.add(folder);
          this.renderList();
        },
        'reference-fold',
      );
      toggle.setAttribute('aria-expanded', String(open));
      const name = document.createElement('span');
      name.textContent = `${folder} (${members.length})`;
      row.append(toggle, visibility(members, `gruppen ${folder}`), name);
      section.append(row);
      if (open)
        for (const model of filtered) {
          const r = document.createElement('div');
          r.className = 'reference-list-row reference-model-row';
          r.append(
            visibility([model], model.title),
            button(
              `Öppna ${model.title}`,
              model.title,
              () => this.showModel(model.id),
              'reference-model-name',
            ),
          );
          section.append(r);
        }
      list.append(section);
    }
    if (query && !list.querySelector('.reference-model-row')) {
      const note = document.createElement('p');
      note.className = 'inspector-note';
      note.textContent = 'Inga träffar';
      list.append(note);
    }
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
      if (part.mesh.visible) bounds.union(new THREE.Box3().setFromObject(part.mesh));
    return bounds;
  }
  dispose(parts) {
    for (const p of parts) {
      p.mesh.geometry.dispose();
      p.mesh.material.map?.dispose();
      p.mesh.material.dispose();
    }
  }
  syncParts() {
    this.parts = this.models.flatMap((model) => model.parts);
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
    if (this.selectedObject?.modelId === id) this.clearObjectSelection();
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
    this.worker?.terminate();
    this.worker = null;
    this.completeImport?.(false);
    this.completeImport = null;
    this.dispose(this.pending || []);
    this.pending = [];
    this.busy(false);
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
  async load(file, { replaceId = null, saved = null, onComplete = null } = {}) {
    const format = file.name.split('.').at(-1).toUpperCase();
    if (format !== 'IFC' && file.size > 10 * 1024 * 1024) {
      this.message('CAD-filen får vara högst 10 MB.', true);
      onComplete?.(false);
      return;
    }
    this.cancel();
    this.completeImport = onComplete;
    this.busy(true);
    this.$('progress').value = 0;
    this.message(`Läser ${format}…`);
    let worker;
    try {
      worker =
        format === 'IFC'
          ? new Worker(new URL('./ifc.worker.js', import.meta.url), { type: 'module' })
          : new Worker(new URL('./cad.worker.js', import.meta.url), { type: 'module' });
    } catch {
      this.cancel();
      this.message(`${format}-läsaren kunde inte starta.`, true);
      return;
    }
    this.worker = worker;
    this.pending = [];
    let source;
    const fail = (message) => {
      if (this.worker !== worker) return;
      this.cancel();
      this.message(message, true);
    };
    worker.onerror = () => fail(`${format}-läsaren kunde inte starta eller slutföra importen.`);
    worker.onmessage = ({ data }) => {
      if (this.worker !== worker) return;
      if (data.type === 'error') {
        fail(data.message);
        return;
      }
      if (data.type === 'progress') {
        this.$('progress').value = data.value;
        return;
      }
      if (data.type === 'cad') {
        try {
          this.pending = cadReferenceParts(data.entities);
          worker.onmessage({
            data: {
              ...data,
              layers: data.layers || cadLayers(data.entities),
              type: 'done',
              schema: format,
            },
          });
        } catch (error) {
          fail(error.message || 'CAD-geometrin kunde inte visas.');
        }
        return;
      }
      if (data.type === 'mesh') {
        try {
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
          geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
          geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(...data.color),
            roughness: 0.85,
            metalness: 0,
            side: THREE.DoubleSide,
            transparent: data.opacity < 1,
            opacity: data.opacity,
            depthWrite: data.opacity >= 1,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.fromArray(data.origin);
          mesh.userData = {
            ifcId: data.id,
            ifcType: data.ifcType,
            name: data.name,
            globalId: data.globalId,
          };
          this.pending.push({
            mesh,
            edges: data.edges,
            index: edgeIndex(data.edges),
            opacity: data.opacity,
          });
        } catch {
          fail('Geometrin kunde inte visas. Prova en mindre IFC-fil.');
        }
        return;
      }
      if (data.type === 'done') {
        const previous = this.models.find((m) => m.id === replaceId);
        if (previous?.id === this.selectedObject?.modelId) this.clearObjectSelection();
        const model = {
          id: saved?.id || previous?.id || crypto.randomUUID(),
          title: previous?.title || file.name,
          fileName: file.name,
          folder: previous?.folder || 'Standard',
          schema: data.schema,
          format,
          source,
          placement: structuredClone(previous?.placement || initialReferencePlacement()),
          locked: previous?.locked || false,
          ...(format !== 'IFC'
            ? {
                placement: structuredClone(
                  previous?.placement || { offset: [0, 0, 0], rotation: 0, scale: 1 },
                ),
                unitFactor: previous?.unitFactor ?? data.unitFactor ?? 1,
                unitKnown: previous?.placement ? previous.unitKnown : data.unitKnown,
                skipped: data.skipped || [],
                layers: data.layers || [],
                layerVisibility: { ...previous?.layerVisibility },
              }
            : {}),
          group: new THREE.Group(),
          parts: this.pending,
          transparent: previous?.transparent || false,
          corners: previous?.corners ?? true,
          edges: previous?.edges ?? true,
        };
        this.pending = [];
        model.group.visible = previous?.group.visible ?? true;
        for (const part of model.parts) {
          if (model.transparent) {
            part.mesh.material.transparent = true;
            part.mesh.material.opacity = 0.3;
            part.mesh.material.depthWrite = false;
          }
          model.group.add(part.mesh);
        }
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
        worker.terminate();
        this.worker = null;
        this.busy(false);
        this.onSelect?.(model);
        this.completeImport?.(true);
        this.completeImport = null;
        this.changed();
        this.message(
          `${format} importerad.${data.skipped?.length ? ' Vissa objekt saknar stöd; se referensens uppgifter.' : ''}`,
        );
        if (model.group.visible && !saved) this.fit(this.bounds());
      }
    };
    try {
      const bytes = await file.arrayBuffer();
      if (this.worker === worker) {
        source = saved?.source || encodeReference(bytes);
        worker.postMessage(format === 'IFC' ? bytes : { bytes, format }, [bytes]);
      }
    } catch {
      if (this.worker === worker) fail('Filen kunde inte läsas.');
    }
  }
  candidates(options) {
    if (!this.group.visible) return [];
    return this.models.flatMap((model) =>
      model.group.visible && (model.corners || model.edges)
        ? referenceCandidates(model.parts, {
            ...options,
            corners: model.corners,
            edges: model.edges,
            labelPrefix: model.format || 'IFC',
          })
        : [],
    );
  }
}
