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
import { drawingLayoutStamp } from './drawing-layout.js';
import { numberWithDrawings, showDrawingBatch } from './drawing-workflows.js';
import { actionButton, actionMenu } from './drawing-toolbar.js';
import { isPhysical } from './model-object.js';
import { partStatus } from './part-marks.js';
export function drawingStamp(record, state) {
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
export class DrawingManager {
  constructor({ getState, change, number, open, highlight, beforeNumber }) {
    Object.assign(this, { getState, change, number, open, highlight, beforeNumber });
    this.dialog = document.createElement('dialog');
    this.dialog.id = 'drawing-manager';
    this.dialog.innerHTML =
      '<header><strong>Ritningar</strong><button type="button" aria-label="Stäng ritningshanteraren">×</button></header><div class="drawing-actions"><button id="drawing-new-ga">Ny GA</button><button id="drawing-new-part">Single Part från markering</button><button id="drawing-number">Numrera detaljer</button></div><p class="inspector-note">Ritningar och numrering finns i den här modellsessionen.</p><div class="drawing-filters"><label>Ritningstyp<select id="drawing-filter"><option value="all">Alla ritningar</option><option value="GA">GA</option><option value="SP">Single Part</option></select></label></div><div class="drawing-list"></div><p role="status" id="drawing-message"></p>';
    document.body.append(this.dialog);
    const button = document.createElement('button');
    button.id = 'drawings-open';
    button.textContent = 'Ritningar';
    document.querySelector('header .history').prepend(button);
    const batchButton = document.createElement('button');
    batchButton.type = 'button';
    batchButton.id = 'single-part-batch-open';
    batchButton.textContent = 'Skapa detaljritningar';
    batchButton.title = 'Skapa Single Part-ritningar från markerade objekt';
    batchButton.onclick = () => {
      this.beforeNumber?.();
      showDrawingBatch(this);
    };
    button.after(batchButton);
    button.onclick = () => {
      this.render();
      this.dialog.showModal();
    };
    this.dialog.querySelector('header button').onclick = () => this.dialog.close();
    this.dialog.addEventListener('keydown', (e) => e.stopPropagation());
    const toolbar = this.dialog.querySelector('.drawing-actions');
    toolbar.classList.add('drawing-commandbar');
    toolbar.setAttribute('aria-label', 'Ritningsåtgärder');
    const create = actionMenu(toolbar, {
      label: 'Ny ritning',
      iconName: 'plus',
      primary: true,
      items: [
        actionButton(this.$('new-ga'), 'page', 'GA · Översikt'),
        actionButton(this.$('new-part'), 'page', 'Single Part · Från markering'),
      ],
    });
    toolbar.prepend(create);
    const filters = this.dialog.querySelector('.drawing-filters');
    toolbar.append(filters);
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
    this.visibleAttributes = new Set(['drawing.revision', 'drawing.date', 'drawing.drawnBy']);
    actionMenu(toolbar, {
      label: 'Mer',
      items: [actionButton(this.$('number'), 'number', 'Numrera detaljer')],
    });
    this.dialog.querySelector('.inspector-note').remove();
    this.$('message').classList.add('drawing-feedback');
    this.$('filter').onchange = () => this.render();
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

  render() {
    const state = this.getState(),
      list = this.dialog.querySelector('.drawing-list'),
      filter = this.$('filter').value;
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
    const records = state.drawings.filter((r) => filter === 'all' || r.type === filter);
    if (!records.length) {
      const empty = document.createElement('p');
      empty.className = 'drawing-empty';
      empty.textContent = 'Inga ritningar att visa.';
      list.append(empty);
      return;
    }
    const table = document.createElement('table');
    table.className = 'drawing-table';
    table.innerHTML =
      '<thead><tr><th>Nummer</th><th>Namn</th><th>Typ</th><th>Status</th></tr></thead><tbody></tbody>';
    for (const a of attributes) {
      const th = document.createElement('th');
      th.textContent = a.name;
      table.querySelector('thead tr').append(th);
    }
    for (const r of records) {
      const row = document.createElement('tr'),
        button = document.createElement('button');
      button.textContent = r.number;
      button.setAttribute('aria-label', `Öppna ${r.number} · ${r.name}`);
      const stamp = drawingStamp(r, state);
      button.onclick = () => {
        if (stamp === null) {
          this.$('message').textContent =
            'Källan saknas eller detaljen har ändrats. Kontrollera numreringen och skapa en ny detaljritning.';
          return;
        }
        const source =
          r.type === 'SP'
            ? state.objects.find(
                (s) =>
                  isPhysical(s) &&
                  state.parts.assignments[s.id]?.key === r.partKey &&
                  partStatus(s, state.objects, state.parts).valid,
              )
            : null;
        this.open(source ? { ...r, sourceId: source.id } : r);
      };
      const status = document.createElement('span');
      status.className = 'drawing-status';
      status.textContent =
        stamp === null
          ? 'Källa ändrad / saknas'
          : r.needsReview
            ? 'Kontrollera ritning'
            : !r.reviewed
              ? 'Ny'
              : r.reviewed === stamp
                ? 'Aktuell'
                : 'Modell ändrad';
      const context = drawingAttributeContext(r, state);
      const inputFor = (a) => {
        if (!attributeApplies(a, r.type)) {
          const span = document.createElement('span');
          span.textContent = '—';
          return span;
        }
        if (!a.editable) {
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
      type.textContent = r.type === 'GA' ? 'GA' : 'Single Part';
      for (const content of [identity, name, type, status, ...attributes.map(inputFor)]) {
        const cell = document.createElement('td');
        cell.append(content);
        row.append(cell);
      }
      table.querySelector('tbody').append(row);
    }
    list.append(table);
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
