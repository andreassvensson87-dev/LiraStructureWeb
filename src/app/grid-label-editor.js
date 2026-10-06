import { parsePositions } from '../grid-lines.js';
import { GRID_LABEL_MAX_LENGTH, gridLabel, gridLabelsAtPositions } from '../grid-labels.js';

export function createGridLabelEditor(panel) {
  const lists = {},
    positions = {},
    drafts = { x: new Map(), y: new Map() };
  for (const axis of ['x', 'y']) {
    positions[axis] = panel.querySelector(`#grid-${axis}`);
    const section = document.createElement('section'),
      heading = document.createElement('h3');
    heading.textContent = `Bubbeltext · ${axis.toUpperCase()}-linjer`;
    lists[axis] = document.createElement('div');
    section.append(heading, lists[axis]);
    panel.append(section);
    positions[axis].addEventListener('input', () => {
      try {
        render(axis, parsePositions(positions[axis].value));
      } catch {
        // Keep the draft labels while the coordinate input is incomplete.
      }
    });
  }
  function render(axis, values) {
    lists[axis].replaceChildren();
    values.forEach((position, index) => {
      const row = document.createElement('label'),
        input = document.createElement('input');
      row.className = 'field';
      row.append(`${axis.toUpperCase()} · ${position.toLocaleString('sv-SE')} mm`);
      input.maxLength = GRID_LABEL_MAX_LENGTH;
      input.setAttribute('aria-label', `Bubbeltext ${axis.toUpperCase()} ${position} mm`);
      input.value = drafts[axis].get(position) ?? '';
      input.placeholder = gridLabel({}, axis, index);
      input.addEventListener('input', () => drafts[axis].set(position, input.value));
      row.append(input);
      lists[axis].append(row);
    });
  }
  return {
    fill(grid) {
      for (const axis of ['x', 'y']) {
        drafts[axis] = new Map(
          grid[axis].map((position, index) => [position, gridLabel(grid, axis, index)]),
        );
        render(axis, grid[axis]);
      }
    },
    read(next) {
      const labels = {};
      for (const axis of ['x', 'y']) {
        const source = {
          [axis]: [...drafts[axis].keys()],
          labels: { [axis]: [...drafts[axis].values()] },
        };
        labels[axis] = gridLabelsAtPositions(source, axis, next[axis]);
      }
      return { ...next, labels };
    },
  };
}
