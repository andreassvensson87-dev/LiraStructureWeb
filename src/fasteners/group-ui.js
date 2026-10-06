import { MAX_GROUP_FASTENERS } from './group-data.js';
import { alignFastenerGroup } from './groups.js';

export function createFastenerGroupEditor(root) {
  root.innerHTML = `<legend><label class="fastener-check"><input type="checkbox" name="groupEnabled">Skruvgrupp</label></legend><div data-group-fields hidden>
    <div class="dimensions"><label class="field">Kolumner · X<input name="groupColumns" type="number" min="1" max="100" step="1" value="2" required></label><label class="field">Rader · Y<input name="groupRows" type="number" min="1" max="100" step="1" value="2" required></label></div>
    <div class="dimensions"><label class="field">Avstånd X · mm<input name="groupSpacingX" type="number" min="0" max="100000" step="any" value="60" required></label><label class="field">Avstånd Y · mm<input name="groupSpacingY" type="number" min="0" max="100000" step="any" value="60" required></label></div>
    <label class="field">Rotation kring skruvaxeln · °<input name="groupRotation" type="number" min="-36000" max="36000" step="any" value="0" required></label>
    <svg class="fastener-group-layout" viewBox="0 0 180 180" role="img" aria-label="Skruvgruppens mönster sett längs skruvaxeln"></svg>
    <p class="inspector-note" data-group-count></p><p class="inspector-note">Första punkten placerar skruven i första raden och kolumnen (grön). X och Y ligger vinkelrätt mot skruvaxeln. Klick på en skruv markerar hela gruppen.</p></div>`;
  const inputs = Object.fromEntries(
    [...root.querySelectorAll('input')].map((input) => [input.name, input]),
  );
  let source = null,
    groupId;
  function render() {
    const enabled = inputs.groupEnabled.checked;
    root.querySelector('[data-group-fields]').hidden = !enabled;
    for (const input of Object.values(inputs))
      if (input !== inputs.groupEnabled) input.disabled = !enabled;
    const rows = Number(inputs.groupRows.value),
      columns = Number(inputs.groupColumns.value);
    const x = Number(inputs.groupSpacingX.value),
      y = Number(inputs.groupSpacingY.value);
    const angle = (Number(inputs.groupRotation.value) * Math.PI) / 180;
    const svg = root.querySelector('svg');
    svg.replaceChildren();
    if (
      !Number.isInteger(rows) ||
      !Number.isInteger(columns) ||
      rows < 1 ||
      columns < 1 ||
      rows * columns > MAX_GROUP_FASTENERS ||
      ![x, y, angle].every(Number.isFinite)
    ) {
      root.querySelector('[data-group-count]').textContent =
        `Högst ${MAX_GROUP_FASTENERS} skruvar per grupp.`;
      return;
    }
    root.querySelector('[data-group-count]').textContent =
      `${columns} × ${rows} = ${columns * rows} skruvar · ${((columns - 1) * x).toLocaleString('sv')} × ${((rows - 1) * y).toLocaleString('sv')} mm`;
    const w = (columns - 1) * x,
      h = (rows - 1) * y;
    const scale = 130 / Math.max(1, Math.hypot(w, h));
    for (let row = 0; row < rows; row++)
      for (let column = 0; column < columns; column++) {
        const px = (column * x - w / 2) * scale,
          py = (row * y - h / 2) * scale;
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', 90 + px * Math.cos(angle) - py * Math.sin(angle));
        circle.setAttribute('cy', 90 - px * Math.sin(angle) - py * Math.cos(angle));
        circle.setAttribute('r', Math.min(5, 40 / Math.max(rows, columns)));
        circle.setAttribute('fill', row === 0 && column === 0 ? '#438d6e' : '#607e8b');
        svg.append(circle);
      }
  }
  root.addEventListener('input', () => {
    render();
  });
  root.addEventListener('change', render);
  return {
    load(nextSource, enabled = false) {
      source = nextSource?.group || null;
      groupId = source?.id || crypto.randomUUID();
      inputs.groupEnabled.checked = !!source || enabled;
      inputs.groupEnabled.disabled = !!source;
      for (const [name, key, fallback] of [
        ['groupRows', 'rows', 2],
        ['groupColumns', 'columns', 2],
        ['groupSpacingX', 'spacingX', 60],
        ['groupSpacingY', 'spacingY', 60],
        ['groupRotation', 'rotation', 0],
      ])
        inputs[name].value = source?.[key] ?? fallback;
      render();
    },
    enabled: () => inputs.groupEnabled.checked,
    apply(draft, start, direction) {
      if (!inputs.groupEnabled.checked) return draft;
      return alignFastenerGroup(
        {
          ...draft,
          group: {
            id: groupId,
            rows: Number(inputs.groupRows.value),
            columns: Number(inputs.groupColumns.value),
            spacingX: Number(inputs.groupSpacingX.value),
            spacingY: Number(inputs.groupSpacingY.value),
            rotation: Number(inputs.groupRotation.value),
            u: source?.u,
          },
        },
        start,
        direction,
      );
    },
  };
}
