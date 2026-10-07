import { drawingAttributes } from './drawing-attributes.js';
import { createAttributeInput, attributeInputValue } from './drawing-attribute-input.js';
import { reportPropertyKeys } from './report-record.js';

export function installReportProperties(module) {
  const root = document.createElement('details');
  root.className = 'report-properties';
  root.open = true;
  root.innerHTML = '<summary>Rapportegenskaper</summary><div></div>';
  const fields = root.querySelector('div');
  const inputs = new Map();
  const labels = {
    number: 'Rapportnummer',
    date: 'Rapportdatum',
    revision: 'Revision',
    issueStatus: 'Status',
    documentType: 'Handlingstyp',
  };
  const set = (values = {}) => {
    fields.replaceChildren();
    inputs.clear();
    for (const key of reportPropertyKeys) {
      const attribute = drawingAttributes().find((a) => a.key === `drawing.${key}`);
      const input = createAttributeInput(attribute || { dataType: 'text' }, values[key] || '');
      input.setAttribute('aria-label', labels[key]);
      input.oninput = () => module.refresh();
      const label = document.createElement('label');
      label.textContent = labels[key];
      label.append(input);
      fields.append(label);
      inputs.set(key, input);
    }
  };
  set();
  module.$('title').closest('label').after(root);
  const toolbar = module.dialog.querySelector('.report-toolbar');
  const bar = document.createElement('div');
  bar.className = 'report-project-bar';
  bar.innerHTML =
    '<label>Rapport<select aria-label="Rapport i projektet"><option value="">Ny rapport</option></select></label><button type="button" data-new>Ny rapport</button><button type="button" data-store>Spara rapport i projektet</button>';
  toolbar.before(bar);
  const select = bar.querySelector('select');
  bar.querySelector('[data-new]').onclick = () => module.newReport();
  bar.querySelector('[data-store]').onclick = () => module.saveReport();
  select.onchange = () => {
    const report = module.project.reports?.find((r) => r.id === select.value);
    if (report) module.loadReport(report);
    else module.newReport();
  };
  return {
    set,
    read: () =>
      Object.fromEntries([...inputs].map(([key, input]) => [key, attributeInputValue(input)])),
    list() {
      select.replaceChildren(
        new Option('Ny rapport', ''),
        ...(module.project.reports || []).map(
          (r) =>
            new Option(
              `${r.number ? r.number + ' · ' : ''}${r.title}${r.revision ? ' · Rev. ' + r.revision : ''}`,
              r.id,
            ),
        ),
      );
      select.value = module.activeReportId || '';
    },
  };
}
