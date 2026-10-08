export function installLayerControls(refs) {
  refs.$('[data-layer-search]').oninput = () => renderLayerControls(refs, refs.selected());
  for (const [selector, visible] of [
    ['[data-layers-all]', true],
    ['[data-layers-none]', false],
  ])
    refs.$(selector).onclick = () => {
      const model = refs.selected();
      if (model)
        refs.setLayersVisible(
          model,
          model.layers.map((l) => l.name),
          visible,
        );
    };
}
export function renderLayerControls(refs, model) {
  const $ = refs.$;
  $('[data-cad-layers]').hidden = !model?.layers;
  if (!model?.layers) return;
  const list = $('[data-layer-list]'),
    scroll = list.scrollTop;
  const focused = list.contains(document.activeElement)
    ? document.activeElement?.dataset.layerName
    : null;
  list.replaceChildren();
  const query = $('[data-layer-search]').value.trim().toLocaleLowerCase('sv');
  const visible = model.layers.filter((l) => model.layerVisibility?.[l.name] !== false).length;
  $('[data-layer-count]').textContent = `${visible} av ${model.layers.length} visas`;
  for (const layer of model.layers.filter((l) => l.name.toLocaleLowerCase('sv').includes(query))) {
    const row = document.createElement('label');
    row.className = 'reference-layer-row';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.layerName = layer.name;
    input.checked = model.layerVisibility?.[layer.name] !== false;
    input.setAttribute('aria-label', `Visa lagret ${layer.name}`);
    input.onchange = () => refs.setLayersVisible(model, [layer.name], input.checked);
    const swatch = document.createElement('span');
    swatch.className = 'reference-layer-color';
    swatch.style.backgroundColor = layer.color;
    swatch.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.className = 'reference-layer-name';
    name.textContent = layer.name;
    name.title = layer.name;
    const count = document.createElement('span');
    count.className = 'reference-layer-count';
    count.textContent = layer.count;
    count.title = `${layer.count} importerade objekt`;
    row.append(input, swatch, name, count);
    list.append(row);
  }
  if (!list.children.length) {
    const empty = document.createElement('p');
    empty.className = 'inspector-note';
    empty.textContent = 'Inga lager matchar sökningen.';
    list.append(empty);
  }
  if (focused)
    [...list.querySelectorAll('input')]
      .find((input) => input.dataset.layerName === focused)
      ?.focus({ preventScroll: true });
  list.scrollTop = scroll;
}
