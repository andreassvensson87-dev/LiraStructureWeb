import { installItemWorkspace } from '../ui/editor-workspace.js';
import { ItemView } from './view.js';
import { addHelperLine } from './guides.js';
import { itemRevision, validateItemDefinition } from './data.js';
import { button, field } from './fields.js';
export class ItemEditor {
  constructor({ getEntry, isBusy, getLibrary, latest, persist, onSaved, onClose, onUse, status }) {
    Object.assign(this, {
      getEntry,
      isBusy,
      getLibrary,
      latest,
      persist,
      onSaved,
      onClose,
      onUse,
      status,
    });
    this.createEditor();
  }
  createEditor() {
    this.editor = document.createElement('dialog');
    this.editor.id = 'item-editor';
    this.editor.setAttribute('aria-label', 'Item-editor');
    this.editor.innerHTML = `<header class="item-header"><div><strong>Item-editor</strong><span>mm · 3D</span></div><button type="button" data-editor-close aria-label="Stäng item-editor">×</button></header>
      <div class="item-editor-layout"><nav class="item-editor-nav"><button type="button" data-back>Tillbaka till bibliotek</button><div data-metadata></div><hr><strong>Hjälpgeometri</strong><p data-helper-count></p><button type="button" data-clear-guides>Rensa hjälplinjer</button><small>Hjälplinjer följer inte med till modellen.</small>
      <details><summary>Hjälplinje via koordinater</summary><div data-helper-coords></div><button type="button" data-add-guide>Lägg till hjälplinje</button></details></nav>
      <section class="item-editor-center"><div class="item-editor-tools"><button type="button" data-mode="select">Markera</button><button type="button" data-mode="start">Startpunkt</button><button type="button" data-mode="end">Slutpunkt</button><button type="button" data-mode="helper">Hjälplinje</button><button type="button" data-fit>Visa allt</button></div>
      <div class="item-editor-tracking"><label><input type="checkbox" data-snap checked> Snap</label><label><input type="checkbox" data-show-guides checked> Visa hjälplinjer</label><label>Arbetsplan <select data-plane><option>XY</option><option>XZ</option><option>YZ</option></select></label><label>Läge · mm <input type="number" data-plane-level step="any" value="0"></label></div><div class="item-editor-view"></div><p class="item-status" data-editor-status role="status"></p></section>
      <form class="item-editor-properties"><strong>Placering</strong><div data-endpoints></div><label class="field">Snap i modellen<select data-model-snap><option value="anchors">Start/slut och referenslinje</option><option value="box">Även omslutande box</option></select></label><small>Fast geometri · Två punkter bestämmer insättning och riktning.</small><p data-editor-error role="alert"></p><button type="submit" class="primary" data-save>Spara version</button><button type="button" data-test>Testa placering</button></form></div>`;
    document.body.append(this.editor);
    this.e$ = (s) => this.editor.querySelector(s);
    this.editor.addEventListener('keydown', (e) => e.stopPropagation());
    const close = () => this.editor.close();
    this.e$('[data-back]').onclick = close;
    this.e$('[data-editor-close]').onclick = close;
    this.editor.addEventListener('close', () => this.endSession());
    this.editor
      .querySelectorAll('[data-mode]')
      .forEach((b) => (b.onclick = () => this.setMode(b.dataset.mode)));
    this.e$('[data-fit]').onclick = () => this.view.fit();
    this.e$('[data-clear-guides]').onclick = () => {
      this.guides = [];
      this.helperStart = null;
      this.updateGuides();
    };
    this.e$('[data-show-guides]').onchange = () => this.updateGuides();
    this.e$('[data-snap]').onchange = (e) => {
      this.view.snap = e.target.checked;
    };
    this.e$('[data-plane]').onchange = (e) => {
      this.view.plane = e.target.value;
    };
    this.e$('[data-plane-level]').oninput = (e) => {
      this.view.planeLevel = Number(e.target.value);
    };
    this.e$('[data-add-guide]').onclick = () => {
      try {
        const points = ['a', 'b'].map((key) =>
          [...this.e$('[data-helper-coords]').querySelectorAll(`[data-item-field^="${key}:"]`)].map(
            (i) => Number(i.value),
          ),
        );
        this.guides = addHelperLine(this.guides, ...points);
        this.updateGuides();
      } catch (error) {
        this.editorStatus(error.message);
      }
    };
    this.e$('form').onsubmit = async (e) => {
      e.preventDefault();
      const definition = await this.saveEditor();
      if (definition) {
        this.editor.close();
        this.status('Ny item-version sparad. Befintliga placeringar behåller sin version.');
      }
    };
    this.e$('[data-test]').onclick = async () => {
      const definition = await this.saveEditor();
      if (definition) {
        this.editor.close();
        this.onUse(definition);
      }
    };
    installItemWorkspace(this.editor);
  }
  endSession() {
    this.session = null;
    this.view?.dispose();
    this.view = null;
    this.draft = null;
    this.editing = null;
    this.mode = null;
    this.guides = [];
    this.helperStart = null;
    for (const selector of ['[data-metadata]', '[data-endpoints]', '[data-helper-coords]'])
      this.e$(selector).replaceChildren();
    this.onClose();
  }
  edit() {
    const entry = this.getEntry();
    if (!entry || this.isBusy()) return;
    this.session = {};
    this.editing = entry;
    this.draft = {
      ...entry.definition,
      start: [...entry.definition.start],
      end: [...entry.definition.end],
    };
    this.guides = [];
    this.helperStart = null;
    const metadata = this.e$('[data-metadata]');
    metadata.replaceChildren();
    for (const [key, label] of [
      ['name', 'Namn'],
      ['article', 'Artikelnummer'],
      ['supplier', 'Leverantör'],
    ]) {
      const input = field(metadata, label, this.draft[key], key);
      input.oninput = () => {
        this.draft[key] = input.value;
      };
    }
    const coords = this.e$('[data-endpoints]');
    coords.replaceChildren();
    for (const key of ['start', 'end']) {
      const group = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = (key === 'start' ? 'Startpunkt' : 'Slutpunkt') + ' · mm';
      group.append(legend);
      const row = document.createElement('div');
      row.className = 'coordinates';
      ['X', 'Y', 'Z'].forEach((axis, i) => {
        const input = field(row, axis, this.draft[key][i], `${key}:${i}`, { type: 'number' });
        input.required = true;
        input.oninput = () => {
          this.draft[key][i] = input.value === '' ? NaN : Number(input.value);
          if (this.draft[key].every(Number.isFinite))
            this.view.setPoints(this.draft.start, this.draft.end);
        };
      });
      group.append(
        row,
        button('Välj i vy', () => this.setMode(key)),
      );
      coords.append(group);
    }
    const helper = this.e$('[data-helper-coords]');
    helper.replaceChildren();
    for (const key of ['a', 'b']) {
      const row = document.createElement('div');
      row.className = 'coordinates';
      ['X', 'Y', 'Z'].forEach((axis, i) =>
        field(
          row,
          `${key === 'a' ? 'Start' : 'Slut'} ${axis}`,
          i === 0 && key === 'b' ? 100 : 0,
          `${key}:${i}`,
          { type: 'number' },
        ),
      );
      helper.append(row);
    }
    this.e$('[data-model-snap]').value = this.draft.snap;
    this.e$('[data-editor-error]').textContent = '';
    this.e$('[data-save]').disabled = this.e$('[data-test]').disabled = !!this.saving;
    this.e$('[data-snap]').checked = true;
    this.e$('[data-show-guides]').checked = true;
    this.e$('[data-plane]').value = 'XY';
    this.e$('[data-plane-level]').value = this.draft.start[2];
    this.editor.showModal();
    this.view = new ItemView(this.e$('.item-editor-view'), {
      pick: (p) => this.pickEditor(p),
      status: (text) => this.editorStatus(text),
    });
    this.view.setItem(this.draft, { points: true });
    this.view.planeLevel = this.draft.start[2];
    this.updateGuides();
    this.setMode('start');
  }
  editorStatus(text) {
    this.e$('[data-editor-status]').textContent = text;
  }
  setMode(mode) {
    this.mode = mode;
    this.helperStart = null;
    this.view.setMode(mode === 'select' ? null : mode);
    this.editor
      .querySelectorAll('[data-mode]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    this.editorStatus(
      mode === 'helper'
        ? 'Hjälplinje · Välj start och slut'
        : mode === 'select'
          ? 'Rotera och undersök item'
          : `Välj ${mode === 'start' ? 'startpunkt' : 'slutpunkt'} på objektet eller en hjälplinje`,
    );
  }
  pickEditor(point) {
    if (this.mode === 'helper') {
      if (!this.helperStart) {
        this.helperStart = point;
        this.editorStatus('Hjälplinje · Välj slutpunkt');
      } else {
        try {
          this.guides = addHelperLine(this.guides, this.helperStart, point);
          this.helperStart = null;
          this.updateGuides();
        } catch (error) {
          this.editorStatus(error.message);
        }
      }
      return;
    }
    if (!['start', 'end'].includes(this.mode)) return;
    this.draft[this.mode] = point.map((v) => Math.round(v * 1000) / 1000);
    for (const input of this.e$('[data-endpoints]').querySelectorAll(
      `[data-item-field^="${this.mode}:"]`,
    ))
      input.value = this.draft[this.mode][Number(input.dataset.itemField.split(':')[1])];
    this.view.setPoints(this.draft.start, this.draft.end);
    this.editorStatus(
      `${this.mode === 'start' ? 'Startpunkt' : 'Slutpunkt'}: ${this.draft[this.mode].map((v) => v.toLocaleString('sv-SE')).join(' · ')} mm`,
    );
  }
  updateGuides() {
    this.e$('[data-helper-count]').textContent = `${this.guides.length} tillfälliga linjer`;
    this.view.setGuides(this.guides, this.e$('[data-show-guides]').checked);
  }
  async saveEditor() {
    if (this.saving || !this.draft) return null;
    const session = this.session;
    this.saving = true;
    this.e$('[data-save]').disabled = this.e$('[data-test]').disabled = true;
    try {
      const latest =
        this.latest().find((e) => e.definition.id === this.draft.id)?.definition || this.draft;
      const definition = itemRevision(latest, {
        ...this.draft,
        revision: latest.revision + 1,
        snap: this.e$('[data-model-snap]').value,
      });
      validateItemDefinition(definition);
      await this.persist({
        ...this.getLibrary(),
        items: [...this.getLibrary().items, { ...this.editing, definition }],
      });
      if (this.session !== session) {
        this.onClose();
        return null;
      }
      this.onSaved(definition);
      return definition;
    } catch (error) {
      if (this.session === session) this.e$('[data-editor-error]').textContent = error.message;
      return null;
    } finally {
      this.saving = false;
      this.e$('[data-save]').disabled = this.e$('[data-test]').disabled = false;
    }
  }
}
