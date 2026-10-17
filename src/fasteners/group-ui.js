import { renderFastenerPattern } from './pattern-picture.js';
import { alignFastenerGroup } from './groups.js';
import { parseBoltDistances, parseBoltCoordinates, patternPositions } from './pattern.js';
import { createAttributeRow } from '../inspector/attributes.js';

/** Presentation of the shared, DOM-free pattern definition. */
export function createFastenerGroupEditor(root) {
  root.classList.add('attribute-group');
  root.innerHTML =
    '<legend><label class="fastener-check"><input type="checkbox" name="groupEnabled">Mönster</label></legend><div data-group-fields hidden><div data-pattern-fields></div><svg class="fastener-group-layout" viewBox="0 0 300 155" role="img" aria-label="Skruvmönster med lokala X- och Y-axlar"></svg><output data-group-count></output></div>';
  const fieldRoot = root.querySelector('[data-pattern-fields]');
  fieldRoot.className = 'attribute-columns';
  const fields = [
    [
      'groupShape',
      'Mönster',
      'select',
      [
        ['array', 'Rutnät'],
        ['circle', 'Cirkel'],
        ['list', 'Fritt'],
      ],
    ],
    ['groupX', 'Delning X', 'text'],
    ['groupY', 'Delning Y', 'text'],
    ['groupCount', 'Antal', 'number'],
    ['groupDiameter', 'Diameter', 'number'],
    ['groupRotation', 'Mönstervinkel', 'number'],
  ];
  for (const [key, label, type, options] of fields) {
    const row = createAttributeRow({
      key,
      label,
      type,
      options,
      ...(type === 'number' ? { step: 'any' } : {}),
    });
    fieldRoot.append(row);
  }
  const inputs = Object.fromEntries(
    [...root.querySelectorAll('input,select')].map((input) => [input.name, input]),
  );
  let source = null,
    groupId,
    reversed = false;
  function definition() {
    const shape = inputs.groupShape.value;
    let pattern;
    if (shape === 'array') {
      const distancesX = parseBoltDistances(inputs.groupX.value),
        distancesY = parseBoltDistances(inputs.groupY.value);
      pattern = {
        distancesX,
        distancesY,
        columns: distancesX.length + 1,
        rows: distancesY.length + 1,
      };
    } else if (shape === 'circle')
      pattern = {
        rows: 1,
        columns: Number(inputs.groupCount.value),
        diameter: Number(inputs.groupDiameter.value),
      };
    else {
      const xs = parseBoltCoordinates(inputs.groupX.value),
        ys = parseBoltCoordinates(inputs.groupY.value);
      if (xs.length !== ys.length) throw new Error('X och Y måste ha lika många koordinater.');
      pattern = { rows: 1, columns: xs.length, positions: xs.map((x, i) => [x, ys[i]]) };
    }
    const group = {
      id: groupId,
      shape,
      ...pattern,
      reversed,
      rotation: Number(inputs.groupRotation.value),
      u: source?.u,
    };
    patternPositions(group);
    return group;
  }
  function render() {
    const enabled = inputs.groupEnabled.checked;
    root.querySelector('[data-group-fields]').hidden = !enabled;
    for (const input of Object.values(inputs))
      if (input !== inputs.groupEnabled) input.disabled = !enabled;
    const circle = inputs.groupShape.value === 'circle';
    for (const key of ['groupX', 'groupY']) inputs[key].parentElement.hidden = circle;
    for (const key of ['groupCount', 'groupDiameter']) inputs[key].parentElement.hidden = !circle;
    const svg = root.querySelector('svg');
    svg.replaceChildren();
    const output = root.querySelector('[data-group-count]');
    if (!enabled) return;
    try {
      const group = definition();
      const count = renderFastenerPattern(svg, group);
      output.textContent = `${count} skruvar`;
      inputs.groupX.title = inputs.groupY.title =
        group.shape === 'list'
          ? 'Koordinater från mönstrets origo'
          : 'Delningar, exempelvis 60 80 60 eller 3*60. 0 ger en position.';
    } catch (error) {
      output.textContent = error.message;
    }
  }
  root.addEventListener('input', render);
  root.addEventListener('change', render);
  return {
    load(nextSource, enabled = false) {
      source = nextSource?.group || null;
      groupId = source?.id || crypto.randomUUID();
      reversed = !!source?.reversed;
      inputs.groupEnabled.checked = !!source || enabled;
      inputs.groupEnabled.disabled = !!source;
      inputs.groupShape.value = source?.shape || 'array';
      inputs.groupX.value =
        source?.shape === 'list'
          ? source.positions.map((p) => p[0]).join(' ')
          : (
              source?.distancesX || Array((source?.columns || 2) - 1).fill(source?.spacingX || 60)
            ).join(' ') || '0';
      inputs.groupY.value =
        source?.shape === 'list'
          ? source.positions.map((p) => p[1]).join(' ')
          : (
              source?.distancesY || Array((source?.rows || 2) - 1).fill(source?.spacingY || 60)
            ).join(' ') || '0';
      inputs.groupCount.value = source?.columns || 6;
      inputs.groupDiameter.value = source?.diameter || 100;
      inputs.groupRotation.value = source?.rotation || 0;
      render();
    },
    renewIdentity() {
      groupId = crypto.randomUUID();
      inputs.groupEnabled.disabled = false;
    },
    enabled: () => inputs.groupEnabled.checked,
    apply(draft, start, direction) {
      if (!inputs.groupEnabled.checked) return draft;
      const result = { ...draft, group: definition() };
      return draft.layout ? result : alignFastenerGroup(result, start, direction);
    },
  };
}
