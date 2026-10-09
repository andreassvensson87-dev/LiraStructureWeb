import { GRID_LABEL_MAX_LENGTH, gridLabel, validateGridLabels } from '../grid-labels.js';

export function createGridLabelEditor(panel, editLine) {
  const lists = {},
    drafts = { x: [], y: [] };
  for (const axis of ['x', 'y']) {
    panel.querySelector(`#grid-${axis}`).closest('label').hidden = true;
    const section = document.createElement('section'),
      heading = document.createElement('h3');
    heading.textContent = `Bubbeltext · ${axis.toUpperCase()}-linjer`;
    lists[axis] = document.createElement('div');
    lists[axis].className = 'grid-text-list';
    section.append(heading, lists[axis]);
    panel.append(section);
  }
  const appearance = document.createElement('section');
  appearance.innerHTML =
    '<h3>Visning i modellen</h3><label class="field">Bubblor<select data-bubble-ends><option value="both">Båda ändar</option><option value="start">Startpunkt</option><option value="end">Slutpunkt</option></select></label><label class="field">Textstorlek<select data-bubble-scale><option value="0.8">Liten</option><option value="1">Normal</option><option value="1.25">Stor</option></select></label><p class="inspector-note">Flytta, vinkla och skapa linjer direkt i modellen. Beteckningen följer sin linje.</p>';
  panel.append(appearance);
  return {
    fill(grid) {
      for (const axis of ['x', 'y']) {
        drafts[axis] = grid[axis].map((_, index) => gridLabel(grid, axis, index));
        lists[axis].replaceChildren();
        drafts[axis].forEach((label, index) => {
          const input = document.createElement('input');
          input.maxLength = GRID_LABEL_MAX_LENGTH;
          input.value = label;
          input.setAttribute('aria-label', `Bubbeltext ${axis.toUpperCase()} ${index + 1}`);
          input.addEventListener('input', () => (drafts[axis][index] = input.value));
          if (editLine) {
            const cell = document.createElement('div'),
              select = document.createElement('button');
            cell.className = 'grid-text-cell';
            select.type = 'button';
            select.textContent = '↗';
            select.title = 'Markera i modellen';
            select.setAttribute('aria-label', `Markera stomlinje ${label} i modellen`);
            select.onclick = () => editLine(axis, index);
            cell.append(input, select);
            lists[axis].append(cell);
          } else lists[axis].append(input);
        });
      }
      appearance.querySelector('[data-bubble-ends]').value = grid.bubbleEnds ?? 'both';
      appearance.querySelector('[data-bubble-scale]').value = String(grid.bubbleScale ?? 1);
    },
    read(grid) {
      const next = structuredClone(grid);
      next.labels = Object.fromEntries(
        ['x', 'y'].map((axis) => [axis, drafts[axis].map((label) => label.trim())]),
      );
      next.bubbleEnds = appearance.querySelector('[data-bubble-ends]').value;
      next.bubbleScale = Number(appearance.querySelector('[data-bubble-scale]').value);
      validateGridLabels(next);
      return next;
    },
  };
}
