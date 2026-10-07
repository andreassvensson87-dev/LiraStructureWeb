export const lineWeights = [
  [0.18, 'Mycket smal'],
  [0.25, 'Smal'],
  [0.35, 'Normal'],
  [0.5, 'Tjock'],
  [0.7, 'Mycket tjock'],
];
export function lineWeightValue(value) {
  return lineWeights.find(([width]) => Math.abs(width - Number(value)) < 1e-6)?.[0] ?? 'custom';
}
export function installLineWeights(input) {
  const label = document.createElement('label'),
    select = document.createElement('select');
  label.textContent = 'Linjevikt';
  select.append(
    ...lineWeights.map(
      ([width, name]) =>
        new Option(`${name} · ${String(width).replace('.', ',')} mm`, String(width)),
    ),
    new Option('Egen tjocklek', 'custom'),
  );
  const update = () => {
    select.value = String(lineWeightValue(input.value));
    label.hidden = input.closest('label').hidden;
  };
  select.onchange = () => {
    if (select.value === 'custom') {
      input.focus();
      return;
    }
    input.value = select.value;
    input.onfocus?.();
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  input.addEventListener('input', update);
  label.append(select);
  input.closest('label').before(label);
  update();
  return { update, label, select };
}
