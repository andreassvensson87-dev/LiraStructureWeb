import { renderFastenerPattern } from './pattern-picture.js';
import { alignFastenerGroup } from './groups.js';
import { parseBoltDistances, parseBoltCoordinates, patternPositions } from './pattern.js';
import { createAttributeRow } from '../inspector/attributes.js';

/** Presentation of the shared, DOM-free pattern definition. */
export function createFastenerGroupEditor(root, { position = null } = {}) {
  root.classList.add('attribute-group');
  root.innerHTML =
    '<legend>Mönster</legend><div data-group-fields><div data-pattern-fields></div><svg class="fastener-group-layout" viewBox="0 0 300 155" role="img" aria-label="Skruvmönster med lokala X- och Y-axlar"></svg><output data-group-count></output></div>';
  const fieldRoot = root.querySelector('[data-pattern-fields]');
  fieldRoot.className = 'attribute-columns';
  const fields = [
    [
      'groupShape',
      'Mönster',
      'select',
      [
        ['single', 'En skruv'],
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
  const inputs = {};
  for (const [key, label, type, options] of fields) {
    const row = createAttributeRow({
      key,
      label,
      type,
      options,
      ...(type === 'number' ? { step: 'any' } : {}),
    });
    inputs[key] = row.querySelector('input,select');
    (key === 'groupRotation' && position ? position : fieldRoot).append(row);
  }
  fieldRoot.querySelector('.attribute-caption').hidden = true;
  let source = null,
    groupId,
    reversed = false;
  function definition() {
    const shape = inputs.groupShape.value;
    let pattern;
    if (shape === 'single') pattern = { rows: 1, columns: 1, distancesX: [], distancesY: [] };
    else if (shape === 'array') {
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
      shape: shape === 'single' ? 'array' : shape,
      ...pattern,
      reversed,
      rotation: Number(inputs.groupRotation.value),
      u: source?.u,
    };
    patternPositions(group);
    return group;
  }
  function render() {
    const single = inputs.groupShape.value === 'single';
    const circle = inputs.groupShape.value === 'circle';
    for (const key of ['groupX', 'groupY']) inputs[key].parentElement.hidden = circle || single;
    for (const key of ['groupCount', 'groupDiameter']) inputs[key].parentElement.hidden = !circle;
    inputs.groupRotation.parentElement.hidden = single;
    const svg = root.querySelector('svg');
    svg.toggleAttribute('hidden', single);
    svg.replaceChildren();
    const output = root.querySelector('[data-group-count]');
    output.hidden = single;
    try {
      const group = definition();
      const count = renderFastenerPattern(svg, group);
      output.textContent = count === 1 ? '1 skruv' : `${count} skruvar`;
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
  if (position) inputs.groupRotation.addEventListener('input', render);
  return {
    load(nextSource) {
      source = nextSource?.group || null;
      groupId = source?.id || crypto.randomUUID();
      reversed = !!source?.reversed;
      inputs.groupShape.value =
        !source || source.rows * source.columns === 1 ? 'single' : source.shape || 'array';
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
    },
    apply(draft, start, direction) {
      const result = { ...draft, group: definition() };
      return draft.layout ? result : alignFastenerGroup(result, start, direction);
    },
  };
}
