import { createInspectorDraft } from '../inspector/field-state.js';
import { fastenerLayoutFromPoints, layoutForFastener } from './placement-frame.js';
import { withFastenerLength, fastenerFitWarnings } from './manual-length.js';
import { createHoleSettings } from './hole-settings.js';
import { changeHoleSettings, resizeFastenerHoles } from './hole-edit.js';
import { createFastenerPlacementForm } from './placement-form.js';
import { createFastenerProductPicker } from './product-picker.js';
import {
  renderFastenerAccessories,
  renderFastenerHoles,
  createFastenerMetadata,
} from './placement-inspector.js';
import { FastenerLibraryController } from './library-controller.js';
import { defaultHoleForSpec, latestFasteners } from './library.js';
import { assemblyDefaults } from './assembly.js';
import { prepareFastenerPlacement, preparePickedFasteners } from './placement-draft.js';
import { createAssemblyPicker } from './assembly-ui.js';
import { createFastenerGroupEditor } from './group-ui.js';
import { selectedFastenerGroup } from './group-data.js';
import { fastenerAccessories } from './accessories.js';
import { isFastener } from './object-type.js';
import { axisPlacement } from './geometry.js';
import { holesForPart } from './relations.js';
import { boreFeature } from './holes.js';
import { isPhysical } from '../model-object.js';
import './style.css';

const button = (text, action) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.onclick = action;
  return b;
};
export class FastenerUI {
  constructor({
    getObjects,
    getWorkPlane,
    getSelection,
    commit,
    beginPlacement,
    finish,
    selectSource,
    showInspector,
    getOperation,
    beginTargets,
    previewPlacement,
  }) {
    Object.assign(this, {
      getObjects,
      getWorkPlane,
      getSelection,
      commit,
      beginPlacement,
      finish,
      selectSource,
      showInspector,
      getOperation,
      beginTargets,
      previewPlacement,
    });
    this.catalog = new FastenerLibraryController({
      useSpec: (spec) => {
        if (this.panel.hidden) this.startCreation();
        const previous = this.activeSpec;
        this.refreshSpecs(`${spec.id}:${spec.revision}`);
        this.activeSpec = previous;
        this.specChanged();
        this.previewRange();
      },
      closed: () => {
        if (this.placeForm.isConnected) this.refreshSpecs(this.placeForm.elements.spec.value);
      },
    });
    const tool = button('Skruvgrupp', () => this.startCreation());
    tool.id = 'fastener';
    tool.setAttribute('aria-label', 'Skruvgrupp');
    tool.setAttribute('aria-pressed', 'false');
    tool.innerHTML =
      '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="7" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><circle cx="7" cy="17" r="3"/><circle cx="17" cy="17" r="3"/></svg><span>Skruvgrupp</span>';
    document.querySelector('.toolbox').append(tool);
    this.panel = document.createElement('section');
    this.panel.id = 'fastener-panel';
    this.panel.hidden = true;
    document.getElementById('form').after(this.panel);
    this.metadata = createFastenerMetadata(
      document.getElementById('inspector-properties'),
      this.panel,
    );
    this.placeForm = createFastenerPlacementForm();
    this.placeForm.dataset.independentEditor = '';
    const groupRoot = document.createElement('fieldset');
    groupRoot.dataset.fastenerGroup = '';
    this.placeForm.querySelector('.fastener-assembly-section').after(groupRoot);
    this.groupEditor = createFastenerGroupEditor(groupRoot, {
      position: this.placeForm.querySelector('.fastener-position-fields'),
    });
    for (const event of ['input', 'change'])
      this.placeForm.addEventListener(event, (e) => e.stopPropagation());
    this.productPicker = createFastenerProductPicker(this.placeForm, {
      openLibrary: () => this.openLibrary({ preserveOperation: true }),
      changed: () => {
        this.specChanged();
        this.previewRange();
      },
    });
    this.placeForm.querySelector('[data-cancel]').onclick = () => this.finish();
    this.placeForm.querySelector('[data-reverse]').dataset.inspectorChoice = '';
    this.placeForm.querySelector('[data-reverse]').onclick = () => {
      this.layoutReversed = !this.layoutReversed;
      this.placeForm
        .querySelector('[data-reverse]')
        .setAttribute('aria-pressed', String(this.layoutReversed));
      this.previewRange();
    };
    this.placeForm.elements.limitLayers.onchange = () => {
      this.syncPlacementMode();
      this.previewRange();
    };
    this.placeForm.addEventListener('input', () => this.previewRange());
    this.placeForm.addEventListener('change', () => this.previewRange());
    this.placeForm.elements.spec.onchange = () => this.specChanged();
    this.holeSettings = createHoleSettings(
      this.placeForm.querySelector('[data-hole-settings]'),
      (key, value) => {
        this.run(this.placeForm, () => {
          this.readHoles();
          this.holeRows = changeHoleSettings(this.holeRows, this.currentSpec(), key, value);
          this.renderHoles();
        });
        this.previewRange();
      },
    );
    this.accessoryRows = [];
    this.assemblyPicker = createAssemblyPicker(
      this.placeForm.querySelector('[data-assembly-picker]'),
      () => this.previewRange(),
    );
    this.placeForm.elements.assemblyMode.onchange = () => this.renderAccessories();
    this.placeForm.elements.customAccessories.onchange = () => {
      if (this.placeForm.elements.customAccessories.checked && !this.accessoryRows.length) {
        const spec = this.currentSpec();
        this.accessoryRows = fastenerAccessories({
          spec,
          nutOffset: Number(this.placeForm.elements.nutOffset.value),
          washers: {
            head: this.placeForm.elements.washerHead.checked,
            nut: this.placeForm.elements.washerNut.checked,
          },
        });
      }
      this.renderAccessories();
    };
    for (const kind of ['nut', 'washer'])
      this.placeForm.querySelector(`[data-add-${kind}]`).onclick = () => {
        this.readAccessories();
        const spec = this.currentSpec();
        const end = Math.max(
          0,
          ...this.accessoryRows.map((item) => item.offset + spec[item.kind].thickness),
        );
        this.accessoryRows.push({
          kind,
          offset:
            kind === 'nut'
              ? Math.max(end, spec.length - (spec.thread?.length ?? spec.length))
              : end,
        });
        this.renderAccessories();
        this.previewRange();
      };
    this.placeForm.querySelector('[data-delete]').onclick = () =>
      document.getElementById('delete').click();
    this.placeForm.querySelector('[data-select-targets]').onclick = () => this.pickTargets();
    this.placeForm.querySelector('[data-apply-hole-defaults]').onclick = () => {
      this.holeRows = this.holeRows.map((h) => this.defaultHole(h.targetId));
      this.renderHoles();
    };
    this.fieldDraft = createInspectorDraft(this.placeForm);
    this.placeForm.onsubmit = (e) => {
      e.preventDefault();
      if (this.getOperation()?.mode === 'fastenerTargets') {
        this.confirmTargets();
        return;
      }
      this.run(this.placeForm, () => {
        const draft = this.readPlacement();
        this.commit(draft);
        this.fieldDraft.accept();
      });
    };
  }

  run(dialog, action) {
    try {
      action();
      dialog.querySelector('[data-error]').textContent = '';
    } catch (e) {
      dialog.querySelector('[data-error]').textContent = e.message;
    }
  }
  get records() {
    return this.catalog.records;
  }
  openLibrary({ preserveOperation = false } = {}) {
    if (!preserveOperation) this.finish();
    this.catalog.openLibrary();
  }
  startCreation() {
    const targets = this.getSelection().filter((s) => isPhysical(s) && !isFastener(s));
    this.finish();
    this.selectSource(null);
    this.loadPlacement(null);
    this.holeRows = targets.map((s) => this.defaultHole(s.id));
    this.anchor = targets[0]?.id || '';
    this.renderHoles();
    this.beginTargets(targets.map((s) => s.id));
  }
  pickTargets() {
    this.readHoles();
    this.beginTargets(this.holeRows.map((h) => h.targetId));
  }
  setTargets(ids) {
    this.readHoles();
    const existing = new Map(this.holeRows.map((h) => [h.targetId, h]));
    this.holeRows = ids.map((id) => existing.get(id) || this.defaultHole(id));
    if (!ids.includes(this.anchor)) this.anchor = ids[0] || '';
    this.renderHoles();
  }
  confirmTargets() {
    this.run(this.placeForm, () => {
      const draft = this.readPlacement();
      if (this.editingObject) {
        this.finish();
        this.commit(draft);
      } else this.beginPlacement(draft);
    });
  }
  availableParts() {
    return this.getObjects().filter((s) => isPhysical(s) && !isFastener(s));
  }
  refreshSpecs(selected) {
    const select = this.placeForm.elements.spec;
    select.replaceChildren(new Option('Välj skruv…', ''));
    const snapshot = this.editingObject?.spec;
    const known = [...(this.editingObject?.lengthOptions || []), ...latestFasteners(this.records)];
    const records = [...new Map(known.map((s) => [`${s.id}:${s.revision}`, s])).values()].filter(
      (s) => !snapshot || `${s.id}:${s.revision}` !== `${snapshot.id}:${snapshot.revision}`,
    );
    if (snapshot) records.unshift(snapshot);
    this.specOptions = records;
    records.forEach((s) =>
      select.append(
        new Option(
          `${s.name} · Ø${s.diameter} × ${s.length} · v${s.revision}`,
          `${s.id}:${s.revision}`,
        ),
      ),
    );
    if (selected && records.some((s) => `${s.id}:${s.revision}` === selected))
      select.value = selected;
    else if (snapshot) select.value = `${snapshot.id}:${snapshot.revision}`;
    else if (records.length) {
      const initial =
        records.find((s) => s.standard === 'ISO 4017' && s.diameter === 12) || records[0];
      select.value = `${initial.id}:${initial.revision}`;
    }
    this.specChanged(false);
  }
  currentSpec() {
    const value = this.placeForm.elements.spec.value;
    return this.specOptions.find((s) => `${s.id}:${s.revision}` === value) || null;
  }
  specChanged(resetNut = true) {
    const spec = this.currentSpec();
    if (resetNut) {
      this.readHoles();
      const previous = this.activeSpec;
      if (previous && spec && previous.diameter !== spec.diameter) {
        this.holeRows = resizeFastenerHoles(this.holeRows, previous, spec);
        this.renderHoles();
      }
      const assembly = this.assemblyPicker.get();
      if (spec?.kind !== 'rod') assembly.nearNut = false;
      this.assemblyPicker.set(spec, assembly);
    }
    this.activeSpec = spec;
    this.productPicker.set(this.specOptions, spec);
    this.placeForm.querySelector('[data-nut-offset]').hidden = true;
    this.placeForm.querySelector('[data-washer-nut]').hidden = spec?.kind !== 'bolt';
    const head = this.placeForm.elements.washerHead,
      nut = this.placeForm.elements.washerNut;
    head.disabled = !spec?.washer || spec.head?.kind === 'countersunk';
    nut.disabled = !spec?.washer || spec.kind !== 'bolt';
    if (head.disabled) head.checked = false;
    if (nut.disabled) nut.checked = false;
    this.placeForm.querySelector('[data-washers]').hidden = head.disabled && nut.disabled;
    this.placeForm.querySelector('[data-washer-info]').textContent = spec?.washer
      ? `Ø${spec.washer.innerDiameter} / Ø${spec.washer.outerDiameter} × ${spec.washer.thickness} mm${head.disabled ? ' · plan bricka passar inte försänkt huvud' : ''}`
      : 'Lägg till brickmått i skruvbiblioteket.';
    if (resetNut)
      this.placeForm.elements.nutOffset.value =
        spec?.kind === 'bolt' ? spec.length - spec.nut.thickness : '';
    if (!resetNut) this.assemblyPicker.set(spec, this.assemblyPicker.get());
    this.renderAccessories();
  }
  defaultHole(targetId) {
    const h = defaultHoleForSpec(this.currentSpec(), targetId);
    return boreFeature(h);
  }
  readAccessories() {
    this.accessoryRows = [...this.placeForm.querySelectorAll('[data-accessory-row]')].map(
      (row) => ({
        kind: row.dataset.accessoryRow,
        offset: row.querySelector('input').value.trim()
          ? Number(row.querySelector('input').value)
          : NaN,
      }),
    );
  }
  renderAccessories() {
    return renderFastenerAccessories({
      currentSpec: this.currentSpec.bind(this),
      placeForm: this.placeForm,
      accessoryRows: this.accessoryRows,
      removeAccessory: (index) => {
        this.readAccessories();
        this.accessoryRows.splice(index, 1);
        this.renderAccessories();
        this.previewRange();
      },
    });
  }
  openPlacement(source = null) {
    this.finish();
    if (!source) source = this.getSelection().find(isFastener) || null;
    if (source) {
      this.selectSource(source.id);
      this.showInspector();
      return;
    }
    this.startCreation();
  }
  loadPlacement(source) {
    if (this.loadedSource?.id !== source?.id) {
      this.placeForm.querySelector('[data-position]').open = false;
      this.placeForm.querySelector('[data-connections]').open = false;
    }
    this.loadedSource = source;
    this.editingObject = source;
    this.layoutReference = source
      ? layoutForFastener(source)
      : {
          frame: this.getWorkPlane(),
          offset: [0, 0, 0],
          rotation: 0,
          reversed: false,
        };
    this.layoutReversed = this.layoutReference.reversed;
    this.placeForm
      .querySelector('[data-reverse]')
      .setAttribute('aria-pressed', String(this.layoutReversed));
    this.groupEditor.load(source);
    const f = this.placeForm.elements;
    const previousSpec = this.placeForm.elements.spec.value;
    this.refreshSpecs(source ? null : previousSpec);
    if (!source && !this.currentSpec() && this.specOptions.length) {
      const spec = this.specOptions[0];
      this.placeForm.elements.spec.value = `${spec.id}:${spec.revision}`;
      this.specChanged();
    }
    f.limitLayers.checked = !!source?.insertion?.automatic && !!source.insertion.limited;
    f.drillDepth.value =
      source?.insertion?.depth ||
      (source?.span
        ? Math.hypot(...source.span.end.map((v, i) => v - source.span.start[i]))
        : this.currentSpec()?.length || 100);
    this.placeForm.querySelector('[data-layer-info]').textContent = source?.layerCount
      ? `${source.layerCount} materiallager i förbandet`
      : '';
    this.syncPlacementMode();
    const start = this.layoutReference.frame.origin;
    const end = start.map(
      (v, i) => v + (this.layoutReference.xLength || 100) * this.layoutReference.frame.u[i],
    );
    f.layoutRotation.value = this.layoutReference.rotation;
    this.layoutReference.offset.forEach((v, i) => (f[`layoutOffset${i}`].value = v));
    start.forEach((v, i) => (f[`start${i}`].value = v));
    end.forEach((v, i) => (f[`direction${i}`].value = v));
    f.nutOffset.value =
      source?.nutOffset ??
      (this.currentSpec()?.kind === 'bolt'
        ? this.currentSpec().length - this.currentSpec().nut.thickness
        : '');
    f.washerHead.checked = !!source?.washers?.head;
    f.washerNut.checked = !!source?.washers?.nut;
    this.holeRows = source
      ? source.holes.map((h) => boreFeature({ ...h, extent: h.extent || 'manual' }))
      : this.getSelection()
          .filter((s) => isPhysical(s) && !isFastener(s))
          .map((s) => this.defaultHole(s.id));
    this.anchor = source?.anchorId ?? this.holeRows[0]?.targetId ?? '';
    this.accessoryRows = source ? fastenerAccessories(source) : [];
    f.customAccessories.checked = source?.accessories != null || this.currentSpec()?.kind === 'rod';
    f.startAllowance.value = source?.startAllowance ?? 20;
    f.assemblyMode.value = source && !source.assembly ? 'manual' : 'preset';
    this.assemblyPicker.set(
      this.currentSpec(),
      source?.assembly || assemblyDefaults(this.currentSpec() || { kind: 'wood' }),
    );
    f.manualLength.value = source?.spec.length ?? this.currentSpec()?.length ?? '';
    const warningSources = source?.group
      ? this.getObjects().filter((s) => s.group?.id === source.group.id)
      : source
        ? [source]
        : [];
    this.placeForm.querySelector('[data-length-result]').textContent = [
      ...new Set(warningSources.flatMap(fastenerFitWarnings)),
    ].join(' ');
    this.placeForm.querySelector('[data-manual-hardware]').open = false;
    this.renderAccessories();
    this.renderHoles();
    this.placeForm.querySelector('[data-delete]').hidden = !source;
    this.placeForm.querySelector('[type=submit]').textContent = source ? 'Tillämpa' : 'Skapa';
    this.productPicker.set(this.specOptions, this.currentSpec());
    this.placeForm.querySelector('[type=submit]').disabled = false;
    this.placeForm.querySelector('[data-delete]').textContent = source?.group
      ? 'Ta bort skruvgrupp'
      : 'Ta bort skruv';
    this.placeForm.querySelector('[data-error]').textContent = '';
    this.fieldDraft.accept();
    this.placeForm.querySelector('[type=submit]').disabled = !!source;
  }
  renderHoles() {
    this.holeSettings.sync(this.holeRows, this.currentSpec());
    const sizes = [
      ...new Set(this.holeRows.filter((h) => h.kind !== 'none').map((h) => h.diameter)),
    ];
    this.placeForm.querySelector('[data-hole-overview]').textContent =
      `${sizes.length ? 'Ø' + sizes.join('/') + ' · ' : ''}${this.holeRows.length} delar`;
    return renderFastenerHoles({
      placeForm: this.placeForm,
      holeRows: this.holeRows,
      getObjects: this.getObjects,
      anchor: this.anchor,
      removeHole: (i, targetId) => {
        this.readHoles();
        this.holeRows.splice(i, 1);
        if (this.anchor === targetId) this.anchor = this.holeRows[0]?.targetId || '';
        this.renderHoles();
      },
      selectAnchor: (value) => {
        this.anchor = value;
      },
    });
  }
  readHoles() {
    this.holeRows = [...this.placeForm.querySelectorAll('[data-hole]')].map((row, i) => {
      const value = (name) => Number(row.querySelector(`[name=${name}]`).value);
      return {
        id: this.holeRows[i].id,
        type: 'bore',
        targetId: this.holeRows[i].targetId,
        kind: row.querySelector('[name=holeKind]').value,
        extent: row.querySelector('[name=extent]').value,
        offset: value('offset'),
        diameter: value('diameter'),
        depth: value('depth'),
        ...(value('csDiameter') || value('csDepth')
          ? { countersink: { diameter: value('csDiameter'), depth: value('csDepth') } }
          : {}),
      };
    });
    this.anchor = this.placeForm.elements.anchor.value;
  }
  readPlacement() {
    const product = this.currentSpec();
    if (!product) throw new Error('Välj en skruv ur biblioteket.');
    const spec = withFastenerLength(product, Number(this.placeForm.elements.manualLength.value));
    this.readHoles();
    this.readAccessories();
    if (!this.holeRows.length) throw new Error('Välj minst ett objekt som ska ingå i förbandet.');
    const f = this.placeForm.elements;
    const start = [0, 1, 2].map((i) => Number(f[`start${i}`].value));
    const direction = [0, 1, 2].map((i) => Number(f[`direction${i}`].value));
    const pickedLayout = fastenerLayoutFromPoints(start, direction, this.layoutReference.frame);
    const layout = {
      ...pickedLayout,
      offset: [0, 1, 2].map((i) => Number(f[`layoutOffset${i}`].value)),
      rotation: Number(f.layoutRotation.value),
      reversed: this.layoutReversed,
      searchLength: f.limitLayers.checked ? Number(f.drillDepth.value) : null,
    };
    let draft = {
      ...(this.editingObject || {}),
      type: 'fastener',
      spec: structuredClone(spec),
      ...axisPlacement(spec, start, direction),
      layout,
      placementMode: 'range',
      drillDepth: Number(f.drillDepth.value),
      holes: structuredClone(this.holeRows),
      washers: { head: f.washerHead.checked, nut: f.washerNut.checked },
      anchorId: this.anchor || null,
      accessories:
        f.assemblyMode.value === 'manual' && f.customAccessories.checked
          ? structuredClone(this.accessoryRows)
          : undefined,
      assembly: f.assemblyMode.value === 'preset' ? this.assemblyPicker.get() : undefined,
      lengthMode: 'manual',
      extraLength: undefined,
      lengthOptions: undefined,
      startAllowance: spec.kind === 'rod' ? Number(f.startAllowance.value) : undefined,
      ...(spec.kind === 'bolt'
        ? {
            nutOffset:
              f.nutOffset.value === ''
                ? spec.length - spec.nut.thickness
                : Number(f.nutOffset.value),
          }
        : { nutOffset: null }),
    };
    draft = this.groupEditor.apply(draft, start, direction);
    const result = prepareFastenerPlacement(draft, {
      model: this.getObjects(),
      start,
      direction,
      limit: f.limitLayers.checked ? Number(f.drillDepth.value) : null,
      fit: !!this.editingObject,
    });
    draft = result.draft;
    this.previewBatch = result.batch;
    const warnings = this.editingObject
      ? [...new Set((this.previewBatch || [draft]).flatMap(fastenerFitWarnings))]
      : [];
    this.placeForm.querySelector('[data-length-result]').textContent = warnings.join(' ');
    return draft;
  }
  showPickedFeedback(batch) {
    if (this.editingObject)
      document.getElementById('object-heading').textContent =
        `Skruvgrupp · ${batch.length} ${batch.length === 1 ? 'skruv' : 'skruvar'}`;
    this.placeForm.querySelector('[data-length-result]').textContent = [
      ...new Set(batch.flatMap(fastenerFitWarnings)),
    ].join(' ');
    const objects = new Map(this.getObjects().map((s) => [s.id, s]));
    for (const [i, hole] of this.holeRows.entries()) {
      const counts = batch
        .map((s) => s.holes.find((h) => h.targetId === hole.targetId))
        .map((h) => (h?.active === false ? 0 : h?.layers?.length || 0));
      const min = Math.min(...counts),
        max = Math.max(...counts);
      const summary = this.placeForm.querySelector(`[data-hole="${i}"] > summary`);
      if (summary)
        summary.textContent = `${objects.get(hole.targetId)?.name || 'Del'} · ${hole.kind === 'none' ? 'Inga hål' : `Ø${hole.diameter} · ${min === max ? min : `${min}–${max}`} lager`}`;
    }
    const reached = new Set(
      batch.flatMap((s) =>
        s.holes
          .filter((h) => h.active !== false && h.kind !== 'none' && h.layers?.length)
          .map((h) => h.targetId),
      ),
    );
    this.placeForm.querySelector('[data-hole-overview]').textContent =
      `${reached.size}/${this.holeRows.length} delar`;
  }
  commitPicked(draft) {
    this.commit(draft);
    this.loadPlacement(draft);
    this.editingObject = null;
    this.loadedSource = null;
    this.groupEditor.renewIdentity();
    this.beginPlacement(this.readPlacement());
  }
  previewRange() {
    this.fieldDraft.sync();
    const operation = this.getOperation();
    const preparing = ['fastenerCreate', 'fastenerTargets'].includes(operation?.mode);
    if (!preparing && !this.editingObject) return;
    try {
      const draft = this.readPlacement();
      if (operation?.mode === 'fastenerCreate') {
        operation.draft = draft;
        delete operation.error;
      }
      let feedback = null;
      if (!preparing) {
        feedback = this.previewBatch || [draft];
        this.previewPlacement(feedback);
      } else if (operation?.mode === 'fastenerCreate' && operation.previewPoints) {
        const [start, xPoint] = operation.previewPoints;
        feedback = preparePickedFasteners(draft, {
          start,
          xPoint,
          frame: operation.frame,
          model: this.getObjects(),
        });
        this.previewPlacement(feedback);
      } else this.previewPlacement(null);
      draft.holes.forEach((h, i) => {
        const summary = this.placeForm.querySelector(`[data-hole="${i}"] > summary`);
        if (summary)
          summary.textContent = `${this.getObjects().find((o) => o.id === h.targetId)?.name || 'Del'}${h.targetId === this.anchor ? ' · Referensdel' : ''} · ${h.kind === 'none' ? 'Ingen borrning' : `Ø${h.diameter} · ${h.kind === 'pilot' ? 'Förborrning' : 'Genomgående'}`} · ${h.layers?.length || 0} lager`;
      });
      this.placeForm.querySelector('[data-hole-overview]').textContent =
        `${draft.holes.length} delar`;
      this.placeForm.querySelector('[data-layer-info]').textContent =
        `${draft.layerCount} materiallager i förbandet`;
      if (feedback) this.showPickedFeedback(feedback);
      this.placeForm.querySelector('[data-error]').textContent = '';
      this.placeForm.querySelector('[type=submit]').disabled =
        !preparing && !this.fieldDraft.sync();
    } catch (e) {
      if (operation?.mode === 'fastenerCreate') operation.error = e.message;
      this.placeForm.querySelector('[type=submit]').disabled = true;
      this.previewPlacement(null);
      this.placeForm.querySelector('[data-length-result]').textContent = '';
      this.placeForm.querySelector('[data-error]').textContent = e.message;
      this.placeForm.querySelector('[data-hole-overview]').textContent =
        `${this.holeRows.length} delar`;
      this.placeForm.querySelector('[data-layer-info]').textContent = '';
    }
  }
  syncPlacementMode() {
    this.placeForm.querySelector('[data-entry-label]').textContent = 'Origo';
    this.placeForm.querySelector('[data-exit-label]').textContent = 'X-riktning';
    const limited = this.placeForm.elements.limitLayers.checked;
    this.placeForm.querySelector('[data-drill-depth]').hidden = !limited;
    this.placeForm.elements.drillDepth.disabled = !limited;
    this.placeForm.elements.drillDepth.required = limited;
  }
  sync(selected, operation) {
    const active =
      ['fastenerTargets', 'fastenerCreate'].includes(operation?.mode) ||
      !!selectedFastenerGroup(selected) ||
      (selected.length === 1 && isFastener(selected[0]));
    if (!active || selected.some((s) => s.generatedBy)) this.metadata.restore();
    this.syncPanel(selected, operation);
    if (active && !this.panel.hidden) this.metadata.show();
  }
  syncPanel(selected, operation) {
    if (selected.length && selected.every((s) => s.generatedBy)) {
      this.panel.hidden = true;
      return;
    }
    const choosing = operation?.mode === 'fastenerTargets';
    const creating = operation?.mode === 'fastenerCreate';
    document.getElementById('fastener').setAttribute('aria-pressed', String(creating || choosing));
    if (choosing) {
      this.panel.hidden = false;
      this.placeForm.dataset.pickingTargets = '';
      if (this.placeForm.parentElement !== this.panel) this.panel.replaceChildren(this.placeForm);
      document.getElementById('form').hidden = document.getElementById('plate-form').hidden = true;
      document.getElementById('object-heading').textContent = 'Skruvgrupp · Välj delar';
      this.placeForm.querySelector('[data-connections]').open = true;
      document.getElementById('mode-label').textContent = '';
      this.placeForm.querySelector('[data-select-targets]').hidden = true;
      this.placeForm.querySelector('[data-position]').hidden = true;
      this.placeForm.querySelector('[data-delete]').hidden = true;
      this.placeForm.querySelector('[type=submit]').hidden = false;
      this.placeForm.querySelector('[type=submit]').textContent = 'Placera ↵';
      this.placeForm.querySelector('[data-target-empty]').textContent = '';
      this.panel.inert = false;
      return;
    }
    if ('pickingTargets' in this.placeForm.dataset)
      this.placeForm.querySelector('[data-connections]').open = false;
    delete this.placeForm.dataset.pickingTargets;
    this.placeForm.querySelector('[data-select-targets]').hidden = false;
    this.placeForm.querySelector('[data-position]').hidden = false;
    if (creating) {
      this.panel.hidden = false;
      if (this.placeForm.parentElement !== this.panel) this.panel.replaceChildren(this.placeForm);
      document.getElementById('form').hidden = document.getElementById('plate-form').hidden = true;
      document.getElementById('object-heading').textContent = 'Skruvgrupp';
      document.getElementById('mode-label').textContent = '';
      this.placeForm.querySelector('[type=submit]').hidden = true;
      this.panel.inert = false;
      return;
    }
    this.placeForm.querySelector('[type=submit]').hidden = false;
    const source =
      selectedFastenerGroup(selected) ||
      (selected.length === 1 && isFastener(selected[0]) ? selected[0] : null);
    const related =
      selected.length === 1
        ? this.getObjects()
            .filter(isFastener)
            .filter((s) => s.holes.some((h) => h.targetId === selected[0].id))
        : [];
    this.panel.hidden = !source && !related.length;
    if (source) {
      if (this.loadedSource !== source) this.loadPlacement(source);
      if (this.placeForm.parentElement !== this.panel) this.panel.replaceChildren(this.placeForm);
      document.getElementById('form').hidden = document.getElementById('plate-form').hidden = true;
      const count = source.group ? source.group.rows * source.group.columns : 1;
      document.getElementById('object-heading').textContent =
        `Skruvgrupp · ${count} ${count === 1 ? 'skruv' : 'skruvar'}`;
      if (source.group) document.getElementById('multi-selection').hidden = true;
    } else {
      this.loadedSource = null;
      this.panel.replaceChildren();
      const shownGroups = new Set();
      for (const s of related) {
        if (s.group && shownGroups.has(s.group.id)) continue;
        if (s.group) shownGroups.add(s.group.id);
        const members = s.group ? related.filter((member) => member.group?.id === s.group.id) : [s];
        const count = holesForPart(selected[0], members).length;
        const name = s.group ? `Skruvgrupp · ${s.group.columns} × ${s.group.rows}` : s.name;
        this.panel.append(
          button(`${name} · ${count ? `${count} kopplade hål` : 'Ingen borrning'}`, () =>
            this.openPlacement(s),
          ),
        );
      }
    }
    this.panel.inert = !!operation;
  }
}
