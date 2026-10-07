export const reportFonts = {
  sans: { label: 'Arial', css: 'Helvetica, Arial, sans-serif', measure: 'Arial' },
  serif: { label: 'Times', css: 'Times, "Times New Roman", serif', measure: 'Times New Roman' },
  mono: { label: 'Courier', css: 'Courier, "Courier New", monospace', measure: 'Courier New' },
};
export const defaultReportTableStyle = {
  tableOnly: false,
  fillViewport: false,
  font: 'sans',
  headerFont: 'sans',
  headerSize: 2.8,
  headerBold: true,
  headerFill: '#e7eeeb',
  headerColor: '#263b43',
  textColor: '#263b43',
  fill: '#ffffff',
  striped: true,
  stripeFill: '#f6f8f7',
  borderColor: '#c8d4d5',
  borderWidth: 0.15,
  paddingX: 2,
  paddingY: 2,
  lineSpacing: 1.4,
};
export const frameReportTableStyle = {
  tableOnly: true,
  fillViewport: true,
  headerFill: '#ffffff',
  headerColor: '#000000',
  textColor: '#000000',
  fill: '#ffffff',
  striped: false,
  stripeFill: '#ffffff',
  borderColor: '#000000',
  borderWidth: 0.25,
};
export function reportTableStyle(value = {}) {
  const style = { ...defaultReportTableStyle, ...value };
  if (!reportFonts[style.font] || !reportFonts[style.headerFont])
    throw Error('Välj ett giltigt typsnitt för tabellen.');
  for (const key of ['headerFill', 'headerColor', 'textColor', 'fill', 'stripeFill', 'borderColor'])
    if (!/^#[0-9a-f]{6}$/i.test(style[key])) throw Error('Ogiltig tabellfärg.');
  for (const [key, min, max] of [
    ['headerSize', 1.5, 6],
    ['borderWidth', 0, 1],
    ['paddingX', 0, 8],
    ['paddingY', 0, 8],
    ['lineSpacing', 1, 2.5],
  ])
    if (!Number.isFinite(style[key]) || style[key] < min || style[key] > max)
      throw Error('Kontrollera tabellens texthöjd, linjevikt och cellmarginaler.');
  for (const key of ['tableOnly', 'fillViewport'])
    if (typeof style[key] !== 'boolean') throw Error('Ogiltigt val för rapportytan.');
  return style;
}

export function installReportTableStyleUI(module) {
  const root = document.createElement('details');
  root.className = 'report-table-style';
  root.innerHTML =
    '<summary>Tabellutseende</summary><div class="report-style-fields"></div><button type="button">Återställ tabellutseende</button>';
  const fields = root.querySelector('div');
  const controls = new Map();
  const add = (key, label, type, options) => {
    const wrapper = document.createElement('label');
    wrapper.textContent = label;
    const input = document.createElement(type === 'select' ? 'select' : 'input');
    input.setAttribute('aria-label', label);
    if (type === 'select')
      input.append(...Object.entries(reportFonts).map(([id, font]) => new Option(font.label, id)));
    else input.type = type;
    for (const [attr, value] of Object.entries(options || {})) input.setAttribute(attr, value);
    input.oninput = () => module.refresh();
    wrapper.append(input);
    fields.append(wrapper);
    controls.set(key, input);
  };
  add('font', 'Typsnitt · innehåll', 'select');
  fields.append(module.$('font').closest('label'));
  add('headerFont', 'Typsnitt · rubriker', 'select');
  add('headerSize', 'Rubrikstorlek · mm', 'number', { min: 1.5, max: 6, step: 0.1 });
  add('headerBold', 'Feta rubriker', 'checkbox');
  add('striped', 'Växelvis radfärg', 'checkbox');
  add('tableOnly', 'Endast tabell i rapportytan', 'checkbox');
  add('fillViewport', 'Kolumnlinjer till nederkanten', 'checkbox');
  for (const [key, label] of [
    ['headerFill', 'Rubrikbakgrund'],
    ['headerColor', 'Rubriktext'],
    ['fill', 'Radbakgrund'],
    ['textColor', 'Innehållstext'],
    ['stripeFill', 'Alternativ radfärg'],
    ['borderColor', 'Linjefärg'],
  ])
    add(key, label, 'color');
  add('borderWidth', 'Linjetjocklek · mm', 'number', { min: 0, max: 1, step: 0.05 });
  add('lineSpacing', 'Radavstånd', 'number', { min: 1, max: 2.5, step: 0.1 });
  add('paddingX', 'Cellmarginal X · mm', 'number', { min: 0, max: 8, step: 0.5 });
  add('paddingY', 'Cellmarginal Y · mm', 'number', { min: 0, max: 8, step: 0.5 });
  module.$('columns').closest('details').before(root);
  const set = (value = {}) => {
    const style = { ...defaultReportTableStyle, ...value };
    for (const [key, input] of controls) {
      if (input.type === 'checkbox') input.checked = style[key];
      else input.value = style[key];
    }
  };
  set();
  root.querySelector('button').onclick = () => {
    set();
    module.$('font').value = '2.8';
    module.refresh();
  };
  return {
    set,
    read: () =>
      reportTableStyle(
        Object.fromEntries(
          [...controls].map(([key, input]) => [
            key,
            input.type === 'checkbox'
              ? input.checked
              : input.type === 'number'
                ? Number(input.value)
                : input.value,
          ]),
        ),
      ),
  };
}
