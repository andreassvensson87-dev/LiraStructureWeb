import { showDrawingRevision } from './drawing-revisions.js';
import { downloadDrawingPDF } from './drawing-pdf.js';
import { positionDrawingMenu } from './drawing-menu-position.js';
import {
  drawingAttributes,
  drawingAttributeContext,
  attributeValue,
  attributeApplies,
  updateDrawingAttribute,
} from './drawing-attributes.js';
import {
  applyDrawingPreset,
  selectedDrawingPreset,
  drawingPresetPicker,
} from './drawing-presets.js';
import { findDrawingLayout, drawingLayoutStamp } from './drawing-layout.js';
import { numberWithDrawings, showDrawingBatch } from './drawing-workflows.js';
import { actionButton, actionMenu } from './drawing-toolbar.js';
import { isPhysical } from './model-object.js';
import { partStatus } from './part-marks.js';
import { assemblyValid } from './project/assemblies.js';
import { drawingAssemblies } from './assembly-numbering.js';
export function drawingStamp(record, state) {
  if (record.type === 'AS') {
    const instances = drawingAssemblies(record, state);
    const assembly = instances.find((a) => a.id === record.assemblyId) || instances[0];
    if (!assemblyValid(assembly, state.objects)) return null;
    return JSON.stringify({
      assembly,
      quantity: instances.length,
      objects: state.objects.filter(
        (o) =>
          assembly.memberIds.includes(o.id) ||
          o.targets?.some((id) => assembly.memberIds.includes(id)) ||
          o.holes?.some((h) => assembly.memberIds.includes(h.targetId)),
      ),
      parts: assembly.memberIds.map((id) => state.parts.assignments[id]),
      sheet: record.sheet,
      settings: record.settings,
      annotations: record.annotations,
      attributes: record.attributes,
      revision: record.revision,
      revisionCreatedBy: record.revisionCreatedBy,
      revisionComment: record.revisionComment,
      revisionDate: record.revisionDate,
      date: record.date,
      drawnBy: record.drawnBy,
      checkedBy: record.checkedBy,
      issueStatus: record.issueStatus,
      typography: record.typography,
      drawingPreset: record.drawingPreset,
      frame: drawingLayoutStamp(record.sheet?.layoutId),
    });
  }
  if (record.type === 'GA' && !state.levels.items.some((l) => l.id === record.levelId)) return null;
  if (record.type === 'GA')
    return JSON.stringify({
      objects: state.objects,
      grid: state.grid,
      level: state.levels.items.find((l) => l.id === record.levelId),
      viewLevels: record.sheet?.views?.map((v) =>
        state.levels.items.find((l) => l.id === v.settings?.levelId),
      ),
      sectionLevels: record.sheet?.views?.some((v) => v.section && v.settings.showLevels !== false)
        ? state.levels.items
        : undefined,
      settings: record.settings,
      sheet: record.sheet,
      attributes: record.attributes,
      revision: record.revision,
      revisionCreatedBy: record.revisionCreatedBy,
      revisionComment: record.revisionComment,
      revisionDate: record.revisionDate,
      date: record.date,
      drawnBy: record.drawnBy,
      checkedBy: record.checkedBy,
      issueStatus: record.issueStatus,
      typography: record.typography,
      drawingPreset: record.drawingPreset,
      frame: drawingLayoutStamp(record.sheet?.layoutId),
      parts: state.parts.assignments,
      annotations: record.annotations,
    });
  const s =
    state.objects.find(
      (s) =>
        s.id === record.sourceId &&
        partStatus(s, state.objects, state.parts).valid &&
        state.parts.assignments[s.id]?.key === record.partKey,
    ) ||
    state.objects.find(
      (s) =>
        isPhysical(s) &&
        state.parts.assignments[s.id]?.key === record.partKey &&
        partStatus(s, state.objects, state.parts).valid,
    );
  if (!s) return null;
  const status = partStatus(s, state.objects, state.parts);
  return status.valid && status.key === record.partKey
    ? JSON.stringify({
        key: status.key,
        mark: status.mark,
        sheet: record.sheet,
        attributes: record.attributes,
        revision: record.revision,
        revisionCreatedBy: record.revisionCreatedBy,
        revisionComment: record.revisionComment,
        revisionDate: record.revisionDate,
        date: record.date,
        drawnBy: record.drawnBy,
        checkedBy: record.checkedBy,
        issueStatus: record.issueStatus,
        typography: record.typography,
        drawingPreset: record.drawingPreset,
        frame: drawingLayoutStamp(record.sheet?.layoutId),
        annotations: record.annotations,
      })
    : null;
}
export function drawingStatus(record, state) {
  const stamp = drawingStamp(record, state);
  if (stamp === null) return { key: 'missing', label: 'Källa ändrad / saknas' };
  if (record.needsReview) return { key: 'changed', label: 'Kontrollera ritning' };
  if (!record.reviewed) return { key: 'new', label: 'Ny' };
  return record.reviewed === stamp
    ? { key: 'current', label: 'Aktuell' }
    : { key: 'changed', label: 'Modell ändrad' };
}
export function drawingFormat(record) {
  const layout = findDrawingLayout(record.sheet?.layoutId || record.drawingPreset?.layoutId);
  if (layout) return layout.name || `${layout.width} × ${layout.height}`;
  return record.sheet?.paper?.name || record.sheet?.paper?.id || 'A3';
}
export function drawingScale(record) {
  const values = record.sheet?.views?.map((view) => view.scale) || [];
  if (!values.length) values.push(record.sheet?.viewScale ?? record.sheet?.scale);
  const scales = [...new Set(values.filter((v) => Number.isFinite(v) && v > 0))];
  return scales.length
    ? scales.map((v) => `1:${Number(v.toFixed(2)).toLocaleString('sv-SE')}`).join(', ')
    : '—';
}
export function drawingManagerRows(
  state,
  { filter = 'all', query = '', sort = 'drawing.number', descending = false } = {},
) {
  const term = query.trim().toLocaleLowerCase('sv');
  const rows = state.drawings
    .map((record) => {
      const context = drawingAttributeContext(record, state);
      const status = drawingStatus(record, state);
      const values = Object.fromEntries(
        drawingAttributes().map((a) => [a.key, attributeValue(a.key, context)]),
      );
      Object.assign(values, {
        status: status.label,
        format: drawingFormat(record),
        scale: drawingScale(record),
      });
      return { record, status, values };
    })
    .filter(
      ({ record, status, values }) =>
        (filter === 'all' ||
          record.type === filter ||
          filter === status.key ||
          (filter === 'update' && ['changed', 'missing'].includes(status.key))) &&
        (!term || Object.values(values).some((v) => v.toLocaleLowerCase('sv').includes(term))),
    );
  return rows.sort(
    (a, b) =>
      (descending ? -1 : 1) *
      String(a.values[sort] || '').localeCompare(String(b.values[sort] || ''), 'sv', {
        numeric: true,
        sensitivity: 'base',
      }),
  );
}
export function duplicateDrawings(records, ids, makeId = () => crypto.randomUUID()) {
  const chosen = records.filter((r) => ids.has(r.id));
  if (chosen.some((r) => r.type === 'AS'))
    throw Error('Assemblyritningar följer assemblyns numrering.');
  const numbers = new Set(records.map((r) => r.number));
  const copies = chosen.map((r) => {
    let i = 1;
    while (numbers.has(`${r.number}-K${i}`)) i++;
    const number = `${r.number}-K${i}`;
    numbers.add(number);
    const copy = {
      ...structuredClone(r),
      id: makeId(),
      number,
      reviewed: null,
      needsReview: false,
    };
    return copy;
  });
  return [...records, ...copies];
}
export class DrawingManager {
  constructor({
    getState,
    change,
    number,
    open,
    exportPDF,
    highlight,
    beforeNumber,
    changeAssemblies,
  }) {
    Object.assign(this, {
      getState,
      change,
      number,
      open,
      exportPDF,
      highlight,
      beforeNumber,
      changeAssemblies,
    });
    this.selection = new Set();
    this.sort = 'drawing.number';
    this.descending = false;
    this.dialog = document.createElement('dialog');
    this.dialog.id = 'drawing-manager';
    this.dialog.innerHTML = `<header><strong>Ritningar</strong><button type="button" aria-label="Stäng ritningshanteraren">×</button></header>
      <div class="drawing-actions"><button id="drawing-new-ga">Ny GA</button><button id="drawing-new-part">Single Part från markering</button><button id="drawing-number">Numrera detaljer</button></div>
      <div class="drawing-manager-body"><nav class="drawing-categories" aria-label="Ritningsfilter"></nav><section class="drawing-manager-content"><input id="drawing-search" type="search" placeholder="Sök ritningar…" aria-label="Sök ritningar"><div class="drawing-list"></div></section></div>
      <footer class="drawing-manager-footer"><div class="drawing-selection-actions"><button id="drawing-open-selected">Öppna</button><button id="drawing-update-selected">Uppdatera</button><button id="drawing-duplicate-selected">Duplicera</button><button id="drawing-revision-selected">Revision…</button><button id="drawing-export-pdf">Exportera PDF</button></div><span id="drawing-count"></span></footer><p role="status" id="drawing-message"></p>`;
    document.body.append(this.dialog);
    const button = document.createElement('button');
    button.id = 'drawings-open';
    button.textContent = 'Ritningar';
    document.querySelector('header .history').prepend(button);
    const createMenu = actionButton(document.createElement('button'), 'plus', 'Skapa ritningar');
    createMenu.onclick = () => showDrawingBatch(this);
    button.after(createMenu);
    this.filter = 'all';
    this.categories = [
      ['all', 'Alla ritningar'],
      ['GA', 'Översiktsritningar'],
      ['SP', 'Detaljritningar'],
      ['AS', 'Assemblyritningar'],
      ['current', 'Aktuella'],
      ['update', 'Behöver uppdateras'],
      ['new', 'Nya'],
    ];
    for (const [key, label] of this.categories) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.filter = key;
      b.textContent = label;
      b.onclick = () => {
        this.filter = key;
        this.render();
      };
      this.dialog.querySelector('.drawing-categories').append(b);
    }
    this.$('search').oninput = () => this.render();
    this.$('open-selected').onclick = this.$('update-selected').onclick = () => {
      const record = this.getState().drawings.find((r) => this.selection.has(r.id));
      if (record) this.openDrawing(record);
    };
    this.$('revision-selected').onclick = () => showDrawingRevision(this);
    this.$('export-pdf').onclick = async () => {
      const records = drawingManagerRows(this.getState(), {
        filter: this.filter,
        query: this.$('search').value,
        sort: this.sort,
        descending: this.descending,
      })
        .map((r) => r.record)
        .filter((r) => this.selection.has(r.id));
      if (!records.length || this.exporting) return;
      this.exporting = true;
      this.dialog.classList.add('drawing-exporting');
      this.$('message').textContent = 'Exporterar PDF…';
      this.$('revision-selected').disabled = !records.length;
      this.$('export-pdf').disabled = true;
      try {
        const blob = await this.exportPDF(records);
        await downloadDrawingPDF(blob, records, this.$('message'));
      } catch (error) {
        this.$('message').textContent = error.message;
      } finally {
        this.exporting = false;
        this.dialog.classList.remove('drawing-exporting');
        this.updateSelection();
      }
    };
    this.dialog.addEventListener('cancel', (event) => {
      if (this.exporting) event.preventDefault();
    });
    this.$('duplicate-selected').onclick = () => {
      const records = this.getState().drawings;
      const next = duplicateDrawings(records, this.selection);
      this.change(next);
      this.selection = new Set(next.slice(records.length).map((r) => r.id));
      this.render();
    };
    button.onclick = () => {
      this.render();
      this.dialog.showModal();
    };
    this.dialog.querySelector('header button').onclick = () => this.dialog.close();
    this.dialog.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (this.exporting) e.preventDefault();
    });
    const toolbar = this.dialog.querySelector('.drawing-actions');
    toolbar.classList.add('drawing-commandbar');
    toolbar.setAttribute('aria-label', 'Ritningsåtgärder');
    const create = actionMenu(toolbar, {
      label: 'Ny ritning',
      iconName: 'plus',
      primary: true,
      items: [
        actionButton(this.$('new-ga'), 'page', 'GA · Översikt'),
        actionButton(this.$('new-part'), 'page', 'Single Part / Assembly'),
      ],
    });
    toolbar.prepend(create);
    const preset = drawingPresetPicker();
    const presetChoice = document.createElement('div');
    presetChoice.className = 'drawing-filters drawing-preset-choice';
    preset.select.title = 'Inställningar för nya ritningar';
    presetChoice.append(preset.label);
    create.after(presetChoice);
    this.presetSelect = preset.select;
    const columns = document.createElement('details');
    columns.className = 'drawing-columns';
    const summary = document.createElement('summary');
    summary.textContent = 'Kolumner';
    this.columnChoices = document.createElement('div');
    columns.append(summary, this.columnChoices);
    toolbar.append(columns);
    const positionColumns = () => {
      if (columns.open) positionDrawingMenu(summary, this.columnChoices);
    };
    columns.addEventListener('toggle', positionColumns);
    window.addEventListener('resize', positionColumns);
    document.addEventListener('pointerdown', (e) => {
      if (!columns.contains(e.target)) columns.open = false;
    });
    columns.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && columns.open) {
        e.preventDefault();
        e.stopPropagation();
        columns.open = false;
        summary.focus();
      }
    });
    this.dialog.addEventListener('close', () => {
      columns.open = false;
    });
    this.visibleAttributes = new Set(['drawing.revision']);
    actionMenu(toolbar, {
      label: 'Mer',
      items: [actionButton(this.$('number'), 'number', 'Numrera detaljer')],
    });
    this.$('message').classList.add('drawing-feedback');
    this.$('new-ga').onclick = () => this.create('GA');
    this.$('new-part').onclick = () => this.create('SP');
    this.$('number').onclick = async () => {
      this.$('number').disabled = true;
      try {
        if (await numberWithDrawings(this))
          this.$('message').textContent = 'Numrering och Single Part-ritningar uppdaterade.';
      } catch (e) {
        this.$('message').textContent = e.message;
      } finally {
        this.$('number').disabled = false;
      }
    };
  }
  $(id) {
    return this.dialog.querySelector('#drawing-' + id);
  }
  create(type) {
    if (type === 'SP') {
      showDrawingBatch(this);
      return;
    }
    const state = this.getState();
    let i = 1;
    while (state.drawings.some((r) => r.number === `GA-${String(i).padStart(3, '0')}`)) i++;
    const record = {
      id: crypto.randomUUID(),
      type: 'GA',
      number: `GA-${String(i).padStart(3, '0')}`,
      name: state.levels.items.find((l) => l.id === state.levels.active).name,
      levelId: state.levels.active,
      settings: { lower: -1000, cut: 1200, upper: 3000, hiddenLines: false },
    };
    applyDrawingPreset(record, selectedDrawingPreset(this.presetSelect?.value));
    this.change([...state.drawings, record]);
    this.render();
    this.$('message').textContent = 'Ritning skapad.';
  }

  openDrawing(record) {
    const state = this.getState();
    if (drawingStamp(record, state) === null) {
      this.$('message').textContent =
        'Ritningens källa saknas eller har ändrats. Kontrollera numreringen.';
      return;
    }
    const source =
      record.type === 'SP'
        ? state.objects.find(
            (s) =>
              isPhysical(s) &&
              state.parts.assignments[s.id]?.key === record.partKey &&
              partStatus(s, state.objects, state.parts).valid,
          )
        : null;
    this.open(source ? { ...record, sourceId: source.id } : record);
  }
  updateSelection() {
    const records = this.getState().drawings.filter((r) => this.selection.has(r.id));
    this.$('open-selected').disabled = this.$('update-selected').disabled =
      records.length !== 1 || drawingStamp(records[0], this.getState()) === null;
    this.$('duplicate-selected').disabled = !records.length || records.some((r) => r.type === 'AS');
    this.$('revision-selected').disabled = !records.length;
    this.$('export-pdf').disabled =
      this.exporting ||
      !records.length ||
      records.some((r) => drawingStamp(r, this.getState()) === null);
    this.$('count').textContent =
      `${this.visibleCount || 0} ritningar · ${records.length} markerade`;
    for (const row of this.dialog.querySelectorAll('tbody tr')) {
      const selected = this.selection.has(row.dataset.id);
      row.classList.toggle('selected', selected);
      row.setAttribute('aria-selected', String(selected));
      row.querySelector('input[type=checkbox]').checked = selected;
    }
    const all = this.$('select-all');
    if (all) {
      const ids = [...this.dialog.querySelectorAll('tbody tr')].map((r) => r.dataset.id);
      const count = ids.filter((id) => this.selection.has(id)).length;
      all.checked = !!ids.length && count === ids.length;
      all.indeterminate = count > 0 && count < ids.length;
    }
  }
  render() {
    const state = this.getState(),
      list = this.dialog.querySelector('.drawing-list');
    this.selection = new Set(
      [...this.selection].filter((id) => state.drawings.some((r) => r.id === id)),
    );
    for (const b of this.dialog.querySelectorAll('[data-filter]')) {
      b.setAttribute('aria-pressed', String(b.dataset.filter === this.filter));
    }
    list.replaceChildren();
    const available = drawingAttributes().filter(
      (a) => !['drawing.number', 'drawing.name', 'drawing.type'].includes(a.key),
    );
    this.columnChoices.replaceChildren(
      ...available.map((a) => {
        const label = document.createElement('label'),
          check = document.createElement('input');
        check.type = 'checkbox';
        check.checked = this.visibleAttributes.has(a.key);
        check.onchange = () => {
          check.checked ? this.visibleAttributes.add(a.key) : this.visibleAttributes.delete(a.key);
          this.render();
        };
        label.append(
          check,
          a.name + (a.scope === 'SP' ? ' · SP' : a.scope === 'GA' ? ' · GA' : ''),
        );
        return label;
      }),
    );
    const attributes = available.filter((a) => this.visibleAttributes.has(a.key));
    const rows = drawingManagerRows(state, {
      filter: this.filter,
      query: this.$('search').value,
      sort: this.sort,
      descending: this.descending,
    });
    const records = rows.map((row) => row.record);
    this.visibleCount = records.length;
    this.selection = new Set([...this.selection].filter((id) => records.some((r) => r.id === id)));
    if (!records.length) {
      const empty = document.createElement('p');
      empty.className = 'drawing-empty';
      empty.textContent = 'Inga ritningar att visa.';
      list.append(empty);
      this.updateSelection();
      return;
    }
    const table = document.createElement('table');
    table.className = 'drawing-table';
    table.innerHTML = '<thead><tr></tr></thead><tbody></tbody>';
    const head = table.querySelector('thead tr');
    const selectCell = document.createElement('th'),
      all = document.createElement('input');
    all.type = 'checkbox';
    all.id = 'drawing-select-all';
    all.setAttribute('aria-label', 'Markera alla visade ritningar');
    all.onchange = () => {
      for (const r of records) all.checked ? this.selection.add(r.id) : this.selection.delete(r.id);
      this.updateSelection();
    };
    selectCell.append(all);
    head.append(selectCell);
    const columns = [
      ['drawing.number', 'Nummer'],
      ['drawing.name', 'Namn'],
      ['drawing.type', 'Typ'],
      ...attributes.map((a) => [a.key, a.name]),
      ['status', 'Status'],
      ['format', 'Format'],
      ['scale', 'Skala'],
    ];
    for (const [key, label] of columns) {
      const th = document.createElement('th'),
        b = document.createElement('button');
      b.type = 'button';
      b.textContent = label + (this.sort === key ? (this.descending ? ' ▾' : ' ▴') : '');
      th.setAttribute(
        'aria-sort',
        this.sort === key ? (this.descending ? 'descending' : 'ascending') : 'none',
      );
      b.onclick = () => {
        this.descending = this.sort === key ? !this.descending : false;
        this.sort = key;
        this.render();
      };
      th.append(b);
      head.append(th);
    }
    for (const r of records) {
      const row = document.createElement('tr'),
        button = document.createElement('button');
      button.textContent = r.number;
      button.setAttribute('aria-label', `Öppna ${r.number} · ${r.name}`);
      button.onclick = () => this.openDrawing(r);
      row.dataset.id = r.id;
      row.tabIndex = 0;
      row.onkeydown = (event) => {
        if (event.target !== row) return;
        if (event.key === 'Enter') {
          event.preventDefault();
          this.openDrawing(r);
        }
        if (event.key === ' ') {
          event.preventDefault();
          this.selection.has(r.id) ? this.selection.delete(r.id) : this.selection.add(r.id);
          this.updateSelection();
        }
      };
      row.onclick = (event) => {
        if (event.target.closest('input,button')) return;
        if (!event.ctrlKey && !event.metaKey) this.selection.clear();
        this.selection.add(r.id);
        this.updateSelection();
      };
      row.ondblclick = (event) => {
        if (!event.target.closest('input,button')) this.openDrawing(r);
      };
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.setAttribute('aria-label', `Markera ${r.number}`);
      checkbox.onchange = () => {
        checkbox.checked ? this.selection.add(r.id) : this.selection.delete(r.id);
        this.updateSelection();
      };
      const status = document.createElement('span');
      status.className = 'drawing-status';
      const currentStatus = rows.find((item) => item.record.id === r.id).status;
      status.textContent = currentStatus.label;
      status.dataset.status = currentStatus.key;
      const context = drawingAttributeContext(r, state);
      const inputFor = (a) => {
        if (!attributeApplies(a, r.type)) {
          const span = document.createElement('span');
          span.textContent = '—';
          return span;
        }
        if (
          !a.editable ||
          (r.type === 'AS' && ['drawing.number', 'drawing.name'].includes(a.key))
        ) {
          const span = document.createElement('span');
          span.textContent = attributeValue(a.key, context) || '—';
          span.title = 'Hämtas från projekt eller modell';
          return span;
        }
        const input = document.createElement('input');
        input.type = a.dataType || 'text';
        input.value = attributeValue(a.key, context);
        input.setAttribute('aria-label', `${a.name} ${r.number}`);
        input.maxLength = 200;
        input.onchange = input.onblur = () => {
          const latest = this.getState().drawings.find((d) => d.id === r.id);
          if (
            !latest ||
            input.value.trim() ===
              attributeValue(a.key, drawingAttributeContext(latest, this.getState()))
          )
            return;
          try {
            this.change(updateDrawingAttribute(this.getState().drawings, r.id, a, input.value));
            this.$('message').textContent = 'Ritningsinformation uppdaterad.';
            this.render();
          } catch (error) {
            this.$('message').textContent = error.message;
            input.value = attributeValue(a.key, context);
          }
        };
        return input;
      };
      const name = inputFor(drawingAttributes().find((a) => a.key === 'drawing.name'));
      const identity = document.createElement('div');
      identity.className = 'drawing-identity';
      identity.append(
        button,
        inputFor(drawingAttributes().find((a) => a.key === 'drawing.number')),
      );
      button.textContent = '↗';
      button.title = 'Öppna ritning';
      const type = document.createElement('span');
      type.textContent = r.type === 'GA' ? 'GA' : r.type === 'AS' ? 'Assembly' : 'Single Part';
      for (const content of [
        checkbox,
        identity,
        name,
        type,
        ...attributes.map(inputFor),
        status,
        drawingFormat(r),
        drawingScale(r),
      ]) {
        const cell = document.createElement('td');
        cell.append(content);
        row.append(cell);
      }
      table.querySelector('tbody').append(row);
    }
    list.append(table);
    this.updateSelection();
  }

  reviewed(record) {
    const state = this.getState(),
      stamp = drawingStamp(record, state);
    this.change(
      state.drawings.map((r) =>
        r.id === record.id
          ? { ...structuredClone(record), needsReview: false, reviewed: stamp }
          : r,
      ),
    );
    this.render();
  }
}
