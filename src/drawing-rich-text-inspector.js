import { createEditorSection } from './ui/editor-surface.js';
import { bindInspectorField } from './inspector/field-state.js';
export function renderRichTextInspector({
  item,
  panel,
  hint,
  dialog,
  draft,
  original,
  content,
  history,
  future,
  change,
  edit,
  remove,
  undo,
  installOrder,
}) {
  panel.replaceChildren();
  panel.parentElement.classList.add('annotation-focused');
  const title = document.createElement('h3');
  title.textContent = 'Text';
  panel.append(title);
  if (!item || item.type !== 'richtext') {
    hint.textContent = 'Dra ut textens bredd på bladet.';
    return;
  }
  const typography = createEditorSection('Typografi', []);
  const placement = createEditorSection('Placering', []);
  const appearance = createEditorSection('Utseende', []);
  panel.append(typography, placement, appearance);
  for (const [labelText, key, min, max] of [
    ['Texthöjd · mm', 'textSize', 0.5, 20],
    ['Bredd · mm', 'width', 10, 2000],
    ['Radavstånd', 'lineSpacing', 1, 4],
  ]) {
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = min;
    input.max = max;
    input.step = 'any';
    input.value = Math.round(item[key] * 1000) / 1000;
    input.onchange = () => {
      const value = Number(input.value);
      if (input.value && Number.isFinite(value) && value >= min && value <= max) change(key, value);
      else input.value = Math.round(item[key] * 1000) / 1000;
    };
    bindInspectorField(
      input,
      () => Math.round(((draft ? original : item)?.[key] ?? item[key]) * 1000) / 1000,
    );
    label.append(input);
    (key === 'width' ? placement : typography).append(label);
  }
  const fontLabel = document.createElement('label');
  fontLabel.textContent = 'Typsnitt';
  const font = document.createElement('select');
  for (const family of ['Arial', 'Verdana', 'Georgia', 'Times New Roman', 'Courier New'])
    font.append(new Option(family, family));
  font.value = item.font;
  font.onchange = () => change('font', font.value);
  bindInspectorField(font, () => (draft ? original : item)?.font ?? item.font);
  fontLabel.append(font);
  typography.append(fontLabel);
  const alignmentLabel = document.createElement('label');
  alignmentLabel.textContent = 'Justering';
  const alignment = document.createElement('select');
  for (const [value, text] of [
    ['mixed', 'Blandad'],
    ['left', 'Vänster'],
    ['center', 'Centrerad'],
    ['right', 'Höger'],
  ])
    alignment.append(new Option(text, value));
  alignment.value = item.paragraphs.every((p) => p.align === item.paragraphs[0].align)
    ? item.paragraphs[0].align
    : 'mixed';
  alignment.onchange = () => {
    if (alignment.value === 'mixed') return;
    if (draft)
      for (const p of content.querySelectorAll('div,p,li')) p.style.textAlign = alignment.value;
    change(
      'paragraphs',
      item.paragraphs.map((p) => ({ ...p, align: alignment.value })),
    );
  };
  bindInspectorField(alignment, () => {
    const paragraphs = (draft ? original : item)?.paragraphs || item.paragraphs;
    return paragraphs.every((p) => p.align === paragraphs[0].align) ? paragraphs[0].align : 'mixed';
  });
  alignmentLabel.append(alignment);
  typography.append(alignmentLabel);
  for (const [key, text] of [
    ['frame', 'Ram'],
    ['background', 'Bakgrund'],
  ]) {
    const label = document.createElement('label'),
      input = document.createElement('input');
    label.className = 'drawing-rich-check';
    input.type = 'checkbox';
    input.checked = item[key];
    input.onchange = () => change(key, input.checked);
    bindInspectorField(input, () => (draft ? original : item)?.[key] ?? item[key]);
    label.append(input, text);
    appearance.append(label);
  }
  for (const [axis, text] of [
    [0, 'X · mm'],
    [1, 'Y · mm'],
  ]) {
    const label = document.createElement('label');
    label.textContent = text;
    const input = document.createElement('input');
    input.type = 'number';
    input.step = 'any';
    input.value = Math.round(item.points[0][axis] * 1000) / 1000;
    input.onchange = () => {
      if (input.value && Number.isFinite(+input.value))
        change('points', [[...item.points[0].map((n, i) => (i === axis ? +input.value : n))]]);
    };
    bindInspectorField(
      input,
      () =>
        Math.round(((draft ? original : item)?.points[0][axis] ?? item.points[0][axis]) * 1000) /
        1000,
    );
    label.append(input);
    placement.append(label);
  }
  const action = (text, fn, disabled = false) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.disabled = disabled;
    b.onclick = fn;
    panel.append(b);
  };
  installOrder(item);
  if (!draft) {
    action('Redigera text', () => edit(item));
    action('Ta bort text', remove);
    action('Ångra', () => undo(), !history.length);
    action('Gör om', () => undo(true), !future.length);
  }
  hint.textContent = draft
    ? 'Redigera text · Ctrl/⌘+Enter bekräftar · Esc avbryter'
    : 'Dubbelklicka för att redigera · dra för att flytta';
  for (const b of dialog.querySelectorAll('[data-drawing-history]'))
    b.disabled = !(b.dataset.drawingHistory === 'redo' ? future : history).length;
}
