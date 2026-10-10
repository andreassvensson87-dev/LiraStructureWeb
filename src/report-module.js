import { createEditorSection } from './ui/editor-surface.js';
import { installDialogPresentation } from './ui/dialog-presentation.js';
import { adoptAttributeLabel } from './inspector/attributes.js';
import { installReportWorkspace } from './ui/editor-workspace.js';
import { drawingAttributes } from './drawing-attributes.js';
import { readDrawingLayouts } from './drawing-layout.js';
import { defaultReportLayout, layoutAppliesTo, REPORT_TEMPLATE_KEY } from './report-layout.js';
import { defaultReportColumns, drawingReportRows } from './report-drawing-list.js';
import { renderReport } from './report-render.js';
import { createDrawingPDF, downloadDrawingPDF } from './drawing-pdf.js';
import './report-module.css';
import { installReportTableStyleUI } from './report-table-style.js';
import { installReportProperties } from './report-properties.js';
import { validateReportRecord } from './report-record.js';
import { FRAME_LIBRARY_KEY } from './frame-model.js';
import {
  defaultMaterialReportColumns,
  materialReportAttributes,
  materialReportData,
} from './report-material-list.js';

export function installReports({ project, frameEditor, finishEditing, checkpoint }) {
  const button = document.createElement('button');
  button.id = 'reports-open';
  button.textContent = 'Rapporter';
  document.querySelector('#drawings-open').after(button);
  const module = new ReportModule(project, frameEditor);
  module.checkpoint = checkpoint;
  button.onclick = () => {
    finishEditing();
    module.open();
  };
  return module;
}
class ReportModule {
  constructor(project, frameEditor) {
    this.project = project;
    this.frameEditor = frameEditor;
    frameEditor.reportTemplates = () => {
      try {
        const values = JSON.parse(localStorage.getItem(REPORT_TEMPLATE_KEY) || '[]');
        return Array.isArray(values) ? values : [];
      } catch {
        return [];
      }
    };
    this.columns = structuredClone(defaultReportColumns);
    this.kind = 'drawing-list';
    this.materialMassCache = new Map();
    const dialog = (this.dialog = document.createElement('dialog'));
    dialog.id = 'report-module';
    dialog.setAttribute('aria-label', 'Rapporter');
    dialog.innerHTML =
      '<header><strong>Rapporter</strong><span>Ritningsförteckning</span><button type="button" data-close>Till modellen</button></header><div class="report-toolbar"><label>Rapportmall<select data-template><option value="">Ny rapportmall</option></select></label><button type="button" data-save-template>Spara mall…</button><button type="button" data-layout-editor>Redigera layouter</button><button type="button" data-pdf>Exportera PDF</button><button type="button" data-csv>Exportera CSV</button></div><div class="report-body"><aside><h3>Rapport</h3><label>Titel<input data-title value="Ritningsförteckning" maxlength="120"></label><label>Första sidan<select data-first></select></label><label>Fortsättningssidor<select data-next></select></label><label>Texthöjd · mm<input data-font type="number" value="2.8" min="1.5" max="6" step="0.1"></label><h3>Urval och sortering</h3><label>Ritningstyp<select data-type><option value="">Alla</option><option value="GA">Översikt</option><option value="SP">Single Part</option><option value="AS">Assembly</option></select></label><label>Filter<input data-search type="search" placeholder="Sök i rapportens kolumner"></label><label>Sortera efter<select data-sort></select></label><details open><summary>Kolumner</summary><p>Bredd anger kolumnens relativa andel av rapportytan.</p><div data-columns></div><button type="button" data-add-column>Lägg till kolumn</button></details></aside><div class="report-preview" aria-label="Rapportens sidor"></div></div><footer><span data-message role="status"></span><span data-count></span></footer>';
    document.body.append(dialog);
    this.$ = (key) => dialog.querySelector(`[data-${key}]`);
    for (const [key, label] of Object.entries({
      template: 'Rapportmall',
      title: 'Titel',
      first: 'Första sidan',
      next: 'Fortsättningssidor',
      font: 'Texthöjd · mm',
      type: 'Ritningstyp',
      search: 'Filter',
      sort: 'Sortera efter',
    }))
      this.$(key).setAttribute('aria-label', label);
    this.tableStyleUI = installReportTableStyleUI(this);
    this.propertiesUI = installReportProperties(this);
    const kindLabel = document.createElement('label');
    kindLabel.innerHTML =
      'Rapporttyp<select data-kind aria-label="Rapporttyp"><option value="drawing-list">Ritningsförteckning</option><option value="material-list">Material- och mängdförteckning</option></select>';
    this.$('title').closest('label').before(kindLabel);
    const grouping = document.createElement('div');
    grouping.dataset.materialOptions = '';
    grouping.innerHTML =
      '<label>Gruppera<select data-group aria-label="Gruppera"><option value="">Ingen gruppering</option><option value="material.material">Material</option><option value="material.profile">Profil</option></select></label><label><input type="checkbox" data-subtotals checked> Delsummor</label><label><input type="checkbox" data-totals checked> Totalsumma</label><p>Vikt från modellgeometri och materialets densitet. Längd för plåt är konturens längsta utbredning.</p>';
    this.$('sort').closest('label').after(grouping);
    this.$('kind').onchange = () => {
      this.kind = this.$('kind').value;
      this.activeReportId = null;
      this.propertiesUI.list();
      this.columns = structuredClone(
        this.kind === 'material-list' ? defaultMaterialReportColumns : defaultReportColumns,
      );
      this.$('title').value =
        this.kind === 'material-list' ? 'Material- och mängdförteckning' : 'Ritningsförteckning';
      this.$('type').value = '';
      this.kindUI();
      this.templates();
      this.columnUI();
      this.refresh();
    };
    for (const key of ['group', 'subtotals', 'totals']) this.$(key).oninput = () => this.refresh();
    this.kindUI();
    this.$('close').onclick = () => dialog.close();
    dialog.addEventListener('keydown', (e) => e.stopPropagation());
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      dialog.close();
    });
    for (const key of ['title', 'first', 'next', 'font', 'type', 'search', 'sort'])
      this.$(key).oninput = () => this.refresh();
    this.$('layout-editor').onclick = () => {
      frameEditor.open();
      frameEditor.switchMode('layout');
      const layout = frameEditor.layouts.find((item) => item.id === this.$('first').value);
      if (layout && !frameEditor.dirty) {
        frameEditor.frame = structuredClone(layout);
        frameEditor.loaded();
      }
    };
    frameEditor.dialog.addEventListener('close', () => {
      if (dialog.open) {
        this.layouts();
        this.refresh();
      }
    });
    installReportWorkspace(dialog);
    this.$('add-column').onclick = () => {
      this.columns.push(
        this.kind === 'material-list'
          ? { key: 'material.totalLength', label: 'Totallängd · m', width: 24, align: 'end' }
          : { key: 'drawing.date', label: 'Datum', width: 20 },
      );
      this.columnUI();
      this.refresh();
    };
    this.$('save-template').onclick = () => this.saveTemplate();
    this.$('template').onchange = () => this.applyTemplate();
    this.$('pdf').onclick = () => this.exportPDF();
    this.$('csv').onclick = () => this.exportCSV();
  }
  kindUI() {
    const material = this.kind === 'material-list';
    this.$('kind').value = this.kind;
    this.dialog.querySelector('header span').textContent = material
      ? 'Material- och mängdförteckning'
      : 'Ritningsförteckning';
    this.dialog.querySelector('[data-material-options]').hidden = !material;
    const type = this.$('type'),
      previous = type.value;
    type.replaceChildren(
      ...(material
        ? [
            ['', 'Alla delar'],
            ['sweep', 'Profiler'],
            ['plate', 'Plåtar'],
            ['fastener', 'Skruvar'],
          ]
        : [
            ['', 'Alla'],
            ['GA', 'Översikt'],
            ['SP', 'Single Part'],
            ['AS', 'Assembly'],
          ]
      ).map(([value, label]) => new Option(label, value)),
    );
    type.value = [...type.options].some((o) => o.value === previous) ? previous : '';
    type.closest('label').firstChild.textContent = material ? 'Deltyp' : 'Ritningstyp';
    type.setAttribute('aria-label', material ? 'Deltyp' : 'Ritningstyp');
  }
  templates() {
    try {
      this.saved = JSON.parse(localStorage.getItem(REPORT_TEMPLATE_KEY) || '[]');
    } catch {
      this.saved = [];
    }
    if (!Array.isArray(this.saved)) this.saved = [];
    const id = this.$('template').value;
    this.$('template').replaceChildren(
      new Option('Ny rapportmall', ''),
      ...this.saved
        .filter((t) => (t.kind || 'drawing-list') === this.kind)
        .map((t) => new Option(t.name, t.id)),
    );
    this.$('template').value = id;
  }
  layouts() {
    this.availableLayouts = readDrawingLayouts().filter((l) => layoutAppliesTo(l, 'report'));
    for (const embedded of [this.assets?.first, this.assets?.next])
      if (embedded && embedded.id && !this.availableLayouts.some((l) => l.id === embedded.id))
        this.availableLayouts.push(embedded);
    for (const key of ['first', 'next']) {
      const select = this.$(key),
        id = select.value;
      select.replaceChildren(
        ...(key === 'next' ? [new Option('Samma som första sidan', 'same')] : []),
        new Option('A4 · standardrapport', ''),
        ...this.availableLayouts.map((l) => new Option(l.name, l.id)),
      );
      if (id && id !== 'same' && !this.availableLayouts.some((l) => l.id === id))
        select.add(new Option('Layout saknas / används inte för rapport', id));
      select.value = id || (key === 'next' ? 'same' : '');
    }
  }
  columnUI() {
    const attributes =
      this.kind === 'material-list'
        ? materialReportAttributes
        : drawingAttributes().filter((a) => !a.key.startsWith('report.'));
    const root = this.$('columns');
    this.columnExpanded ??= new WeakMap();
    root.replaceChildren();
    this.columns.forEach((column, index) => {
      const row = createEditorSection(`Kolumn ${index + 1} · ${column.label}`, [], {
        open: this.columnExpanded.get(column) ?? index === 0,
      });
      row.classList.add('report-column');
      row.ontoggle = () => this.columnExpanded.set(column, row.open);
      const select = document.createElement('select');
      select.setAttribute('aria-label', `Kolumn ${index + 1} · attribut`);
      select.append(...attributes.map((a) => new Option(a.name, a.key)));
      if (!attributes.some((a) => a.key === column.key))
        select.add(new Option(column.key, column.key));
      select.value = column.key;
      select.onchange = () => {
        column.key = select.value;
        column.label = attributes.find((a) => a.key === select.value)?.name || select.value;
        this.columnUI();
        this.refresh();
      };
      const label = document.createElement('input');
      label.value = column.label;
      label.setAttribute('aria-label', `Kolumn ${index + 1} · rubrik`);
      label.oninput = () => {
        column.label = label.value;
        row.querySelector('summary').textContent = `Kolumn ${index + 1} · ${column.label}`;
        this.$('sort').options[index].textContent = label.value;
        this.refresh();
      };
      const width = document.createElement('input');
      width.type = 'number';
      width.min = '1';
      width.step = 'any';
      width.value = column.width;
      width.setAttribute('aria-label', `Kolumn ${index + 1} · bredd`);
      width.oninput = () => {
        column.width = Number(width.value);
        this.refresh();
      };
      const up = document.createElement('button');
      const align = document.createElement('select');
      align.className = 'report-column-align';
      align.setAttribute('aria-label', `Kolumn ${index + 1} · justering`);
      align.append(
        new Option('Vänster', 'start'),
        new Option('Centrerat', 'middle'),
        new Option('Höger', 'end'),
      );
      align.value = column.align || 'start';
      align.onchange = () => {
        column.align = align.value;
        this.refresh();
      };
      up.textContent = '↑';
      up.setAttribute('aria-label', `Flytta upp kolumn ${index + 1}`);
      up.disabled = index === 0;
      up.onclick = () => {
        [this.columns[index - 1], this.columns[index]] = [column, this.columns[index - 1]];
        this.columnUI();
        this.refresh();
      };
      const remove = document.createElement('button');
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Ta bort kolumn ${index + 1}`);
      remove.onclick = () => {
        this.columns.splice(index, 1);
        this.columnUI();
        this.refresh();
      };
      const field = (caption, control) => {
        const wrapper = document.createElement('label');
        wrapper.textContent = caption;
        wrapper.append(control);
        adoptAttributeLabel(wrapper);
        return wrapper;
      };
      const options = document.createElement('div');
      options.className = 'report-column-options';
      options.append(field('Bredd · andel', width), field('Justering', align));
      const actions = document.createElement('div');
      actions.className = 'report-column-actions';
      actions.append(up, remove);
      row.append(field('Attribut', select), field('Rubrik', label), options, actions);
      root.append(row);
    });
    const sort = this.$('sort'),
      key = sort.value;
    sort.replaceChildren(...this.columns.map((c) => new Option(c.label, c.key)));
    sort.value = this.columns.some((c) => c.key === key) ? key : this.columns[0]?.key || '';
  }
  open() {
    this.templates();
    this.layouts();
    this.columnUI();
    const active = this.project.reports?.find((r) => r.id === this.activeReportId);
    if (active) this.loadReport(active);
    else {
      this.activeReportId = null;
      this.assets = null;
      this.propertiesUI.list();
    }
    this.dialog.showModal();
    this.refresh();
  }
  config() {
    return {
      kind: this.kind,
      group: this.$('group').value,
      subtotals: this.$('subtotals').checked,
      totals: this.$('totals').checked,
      columns: structuredClone(this.columns),
      tableStyle: this.tableStyleUI.read(),
      ...Object.fromEntries(
        ['title', 'first', 'next', 'font', 'type', 'search', 'sort'].map((k) => [
          k,
          this.$(k).value,
        ]),
      ),
    };
  }
  applyTemplate() {
    const template = this.saved.find((t) => t.id === this.$('template').value);
    if (!template) return;
    this.assets = null;
    this.applyConfig(template);
  }
  applyConfig(template) {
    this.kind = template.kind || 'drawing-list';
    this.kindUI();
    this.templates();
    this.$('group').value = template.group || '';
    this.$('subtotals').checked = template.subtotals ?? true;
    this.$('totals').checked = template.totals ?? true;
    this.columns = structuredClone(template.columns);
    this.tableStyleUI.set(template.tableStyle);
    for (const key of ['title', 'first', 'next', 'font', 'type', 'search', 'sort']) {
      const input = this.$(key);
      if (
        ['first', 'next'].includes(key) &&
        template[key] &&
        ![...input.options].some((o) => o.value === template[key])
      )
        input.add(new Option('Layout saknas / används inte för rapport', template[key]));
      input.value = template[key];
    }
    this.columnUI();
    this.refresh();
  }
  refresh() {
    this.pages = [];
    this.rows = [];
    this.$('message').textContent = '';
    this.$('count').textContent = '';
    this.dialog.querySelector('.report-preview').replaceChildren();
    try {
      const c = this.config();
      if (!c.title.trim()) throw Error('Ange en rapporttitel.');
      const fontSize = Number(c.font);
      if (!(fontSize >= 1.5 && fontSize <= 6)) throw Error('Texthöjd: 1,5–6 mm.');
      const layout = (id) => {
        const embedded = [this.assets?.first, this.assets?.next].find((l) => l?.id === id);
        if (embedded) return embedded;
        if (!id) return defaultReportLayout();
        const l = this.availableLayouts.find((l) => l.id === id);
        if (!l) throw Error('Vald rapportlayout saknas. Välj en annan layout.');
        return l;
      };
      const firstLayout = layout(c.first),
        nextLayout = c.next === 'same' ? firstLayout : layout(c.next);
      this.renderedLayouts = { first: firstLayout, next: nextLayout };
      const libraryBlocks = JSON.parse(localStorage.getItem(FRAME_LIBRARY_KEY) || '[]');
      const embeddedBlocks = this.assets?.blocks || [];
      this.renderedBlocks = [
        ...embeddedBlocks,
        ...libraryBlocks.filter((b) => !embeddedBlocks.some((e) => e.id === b.id)),
      ];
      const material = this.kind === 'material-list';
      const data = material
        ? materialReportData(this.project, this.columns, {
            ...c,
            massCache: this.materialMassCache,
          })
        : null;
      this.rows = data
        ? data.rows
        : drawingReportRows(this.project, this.columns, {
            search: c.search,
            type: c.type,
            sort: c.sort,
          });
      this.$('message').textContent = data?.warnings.join(' · ') || '';
      this.pages = renderReport({
        title: c.title,
        rows: this.rows,
        columns: this.columns,
        firstLayout,
        nextLayout,
        fontSize,
        project: this.project.info,
        tableStyle: c.tableStyle,
        properties: { ...this.propertiesUI.read(), kind: this.kind, partCount: data?.partCount },
        rowKinds: data?.rowKinds,
        rowCount: data?.groupCount,
        blocks: this.renderedBlocks,
      });
      for (const [i, page] of this.pages.entries()) {
        const figure = document.createElement('figure');
        const caption = document.createElement('figcaption');
        caption.textContent = `Sida ${i + 1} av ${this.pages.length} · ${page.width} × ${page.height} mm`;
        figure.append(page.svg, caption);
        this.dialog.querySelector('.report-preview').append(figure);
      }
      this.$('count').textContent =
        `${material ? data.partCount + ' delar · ' + data.groupCount + ' poster' : this.rows.length + (this.rows.length === 1 ? ' ritning' : ' ritningar')} · ${this.pages.length} ${this.pages.length === 1 ? 'sida' : 'sidor'}`;
    } catch (error) {
      this.$('message').textContent = error.message;
    }
    this.$('pdf').disabled = this.exporting || !this.pages.length;
    this.$('csv').disabled = !this.pages.length;
  }
  saveTemplate() {
    const dialog = document.createElement('dialog');
    dialog.className = 'report-template-name';
    dialog.innerHTML =
      '<form><h3>Spara rapportmall</h3><label>Namn<input required maxlength="120"></label><p role="status"></p><footer><button type="button">Avbryt</button><button type="submit">Spara</button></footer></form>';
    document.body.append(dialog);
    installDialogPresentation(dialog);
    dialog.addEventListener('keydown', (e) => e.stopPropagation());
    dialog.querySelector('input').value =
      this.saved.find((t) => t.id === this.$('template').value)?.name || this.$('title').value;
    dialog.querySelector('button').onclick = () => dialog.close();
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    dialog.querySelector('form').onsubmit = (e) => {
      e.preventDefault();
      try {
        if (!this.pages.length)
          throw Error('Rätta rapportens inställningar innan du sparar mallen.');
        const name = dialog.querySelector('input').value.trim();
        if (!name) throw Error('Ange ett namn.');
        const existing = this.saved.find((t) => t.name === name);
        const template = { ...this.config(), name, id: existing?.id || crypto.randomUUID() };
        const next = [...this.saved.filter((t) => t.id !== template.id), template];
        localStorage.setItem(REPORT_TEMPLATE_KEY, JSON.stringify(next));
        this.templates();
        this.$('template').value = template.id;
        dialog.close();
        this.$('message').textContent = 'Rapportmallen sparad.';
      } catch (error) {
        dialog.querySelector('[role=status]').textContent = error.message;
      }
    };
    dialog.showModal();
  }
  newReport() {
    this.activeReportId = null;
    this.assets = null;
    this.propertiesUI.set({ date: new Date().toLocaleDateString('sv-SE') });
    this.propertiesUI.list();
    this.refresh();
  }
  loadReport(report) {
    this.activeReportId = report.id;
    this.assets = structuredClone(report.assets);
    this.layouts();
    this.propertiesUI.set(report);
    this.applyConfig(report);
    this.propertiesUI.list();
    this.$('template').value = '';
  }
  saveReport() {
    try {
      if (!this.pages.length) throw Error('Rätta rapportens inställningar innan du sparar.');
      const blocks = this.renderedBlocks;
      const used = new Set(
        [this.renderedLayouts.first, this.renderedLayouts.next].flatMap((l) =>
          l.entities.map((e) => e.blockId),
        ),
      );
      const report = validateReportRecord(
        structuredClone({
          ...this.config(),
          ...this.propertiesUI.read(),
          id: this.activeReportId || crypto.randomUUID(),
          kind: this.kind,
          assets: { ...this.renderedLayouts, blocks: blocks.filter((b) => used.has(b.id)) },
        }),
      );
      this.checkpoint?.();
      this.project.reports = [
        ...(this.project.reports || []).filter((r) => r.id !== report.id),
        report,
      ];
      this.activeReportId = report.id;
      this.assets = report.assets;
      this.propertiesUI.list();
      this.$('message').textContent = 'Rapport sparad i projektet · Spara projektfilen via Arkiv.';
    } catch (error) {
      this.$('message').textContent = error.message;
    }
  }
  async exportPDF() {
    if (this.exporting || !this.pages.length) return;
    const title = this.$('title').value,
      pages = this.pages;
    this.exporting = true;
    this.$('pdf').disabled = true;
    try {
      const blob = await createDrawingPDF(pages, { title });
      await downloadDrawingPDF(blob, [{ number: title }], this.$('message'));
    } catch (error) {
      this.$('message').textContent = error.message;
    } finally {
      this.exporting = false;
      this.$('pdf').disabled = !this.pages.length;
    }
  }
  exportCSV() {
    const quote = (v) =>
      '"' + (/^[=+\-@\t\r]/.test(String(v)) ? "'" : '') + String(v).replaceAll('"', '""') + '"';
    const csv =
      '\ufeff' +
      [this.columns.map((c) => c.label), ...this.rows]
        .map((row) => row.map(quote).join(';'))
        .join('\r\n');
    const link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    link.download = this.$('title').value.replace(/[\\/:*?"<>|]/g, '_') + '.csv';
    link.textContent = 'Hämta CSV';
    this.$('message').replaceChildren(link);
    link.click();
  }
}
