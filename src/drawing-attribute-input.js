import { attributeOptions } from './drawing-attributes.js';

export function createAttributeInput(attribute, value) {
  if (!['choice', 'multichoice'].includes(attribute.dataType)) {
    const input = document.createElement('input');
    input.type = attribute.dataType || 'text';
    input.value = Array.isArray(value) ? value.join(', ') : String(value ?? '');
    input.maxLength = 200;
    return input;
  }
  const select = document.createElement('select');
  select.multiple = attribute.dataType === 'multichoice';
  const current = Array.isArray(value) ? value : value ? [String(value)] : [];
  const options = attributeOptions([...attributeOptions(attribute.options), ...current]);
  if (!select.multiple) select.add(new Option('—', ''));
  for (const value of options) {
    const option = new Option(value, value);
    option.selected = current.includes(value);
    select.add(option);
  }
  if (!select.multiple) select.value = current[0] || '';
  else {
    select.size = Math.min(4, Math.max(2, options.length));
    select.title =
      'Välj flera med Ctrl/Cmd. Klicka på ett valt värde med Ctrl/Cmd för att ta bort det.';
  }
  return select;
}
export function attributeInputValue(input) {
  return input.multiple ? [...input.selectedOptions].map((o) => o.value) : input.value;
}
export function attributeInputUnchanged(attribute, value, previous) {
  if (attribute.dataType !== 'multichoice') return String(value).trim() === String(previous);
  const before = Array.isArray(previous) ? previous : previous ? [String(previous)] : [];
  return value.length === before.length && value.every((v) => before.includes(v));
}
