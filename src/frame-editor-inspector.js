import { REPORT_VIEWPORT_ID } from './report-viewport-grips.js';

import { propertyFields, commonFields, propertyValue } from './frame-properties.js';

export function renderFrameProperties({
  frame,
  selected: selection,
  mode,
  tool,
  changedProperties,
  fieldDraft,
  dialog,
  reportControls,
  $,
  lineWeightControl,
  updatePalette,
  setVisibleProperties,
}) {
  const selected = frame.entities.filter((e) => selection.has(e.id));
  const reportSelected = mode === 'layout' && selection.has(REPORT_VIEWPORT_ID);
  const creating = ['line', 'polyline', 'text', 'attribute', 'image', 'insert'].includes(tool);
  const type = tool === 'polyline' ? 'line' : tool === 'insert' ? 'block' : tool;
  const fields = creating ? propertyFields[type] || [] : commonFields(selected),
    active = creating || selected.length > 0;
  setVisibleProperties(fields);
  changedProperties.clear();
  dialog.querySelector('.fe-paper').hidden = !!active || reportSelected || tool === 'report-area';
  reportControls.selection(reportSelected || tool === 'report-area');
  dialog.querySelector('.fe-entity-properties').hidden = !active || mode === 'layout';
  dialog.querySelector('.fe-block-placement').hidden = !active || mode !== 'layout';
  $('selection').textContent = creating
    ? { line: 'Ny linje', text: 'Ny text', attribute: 'Ny attributtext', image: 'Ny bild' }[type] ||
      'Nytt objekt'
    : selected.length === 1
      ? { line: 'Linje / polylinje', text: 'Text', attribute: 'Attributtext', image: 'Bild' }[
          selected[0].type
        ] || 'Ramblock'
      : `${selected.length} markerade · gemensamma egenskaper`;
  for (const key of new Set(Object.values(propertyFields).flat())) {
    const input = $(key);
    input.closest('label').hidden = !fields.includes(key);
    if (input.tagName === 'SELECT') input.querySelector('option[data-mixed]')?.remove();
    if (!creating && fields.includes(key)) {
      const values = selected.map((e) => propertyValue(e, key)),
        mixed = values.some((v) => v !== values[0]);
      if (mixed && input.tagName === 'SELECT') {
        const option = new Option('Blandat', '');
        option.dataset.mixed = 'true';
        input.prepend(option);
      }
      input.value = mixed ? '' : values[0];
      input.placeholder = mixed ? 'Blandat' : '';
    }
  }
  for (const row of dialog.querySelectorAll('.fe-entity-properties .fe-pair'))
    row.hidden = [...row.children].every((e) => e.hidden);
  lineWeightControl.update();
  $('ratio').parentElement.hidden = !fields.includes('imageWidth');
  dialog.querySelector('[data-action="properties"]').hidden = creating || !fields.length;
  dialog.querySelector('[data-action="instanceApply"]').hidden = creating;
  $('instances').hidden = active;
  updatePalette();
  dialog.querySelector('.fe-origin-fields').hidden = mode !== 'block';
  $('originX').value = frame.origin?.[0] || 0;
  $('originY').value = frame.origin?.[1] || 0;
  for (const key of ['originX', 'originY']) $(key).parentElement.hidden = mode !== 'block';
  fieldDraft.accept();
  dialog.querySelector('[data-action="originApply"]').hidden = mode !== 'block';
}
export function renderFrameInstances({
  mode,
  $,
  frame,
  blocks,
  properties,
  render,
  selectInstance,
}) {
  if (mode !== 'layout') return;
  $('instances').replaceChildren();
  for (const e of frame.entities) {
    const b = document.createElement('button');
    b.textContent = blocks.find((block) => block.id === e.blockId)?.name || 'Block saknas';
    b.onclick = () => {
      selectInstance(e.id);
      properties();
      render();
    };
    $('instances').append(b);
  }
}
