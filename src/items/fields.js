import { adoptAttributeLabel } from '../inspector/attributes.js';
export const button = (text, action, className = '') => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.className = className;
  b.onclick = action;
  return b;
};
export const field = (root, label, value, key, { readonly = false, type = 'text' } = {}) => {
  const row = document.createElement('label');
  row.className = 'field';
  row.textContent = label;
  const input = document.createElement('input');
  input.type = type;
  input.value = type === 'number' ? Math.round(value * 1000) / 1000 : value;
  input.dataset.itemField = key;
  input.readOnly = readonly;
  if (type === 'number') input.step = 'any';
  row.append(input);
  adoptAttributeLabel(row);
  root.append(row);
  return input;
};
