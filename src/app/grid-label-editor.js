import { validateGridLabels } from '../grid-labels.js';

// Settings only control appearance; each line's label belongs to the model editor.
export function createGridLabelEditor(panel) {
  for (const axis of ['x', 'y'])
    panel.querySelector(`#grid-${axis}`).closest('label').hidden = true;
  const appearance = document.createElement('section');
  appearance.innerHTML =
    '<h3>Visning i modellen</h3><label class="field">Bubblor<select data-bubble-ends><option value="both">Båda ändar</option><option value="start">Startpunkt</option><option value="end">Slutpunkt</option></select></label><label class="field">Textstorlek<select data-bubble-scale><option value="0.8">Liten</option><option value="1">Normal</option><option value="1.25">Stor</option></select></label><p class="inspector-note">Markera en stomlinje i modellen och ändra dess egenskaper i inspektorn.</p>';
  panel.append(appearance);
  return {
    fill(grid) {
      appearance.querySelector('[data-bubble-ends]').value = grid.bubbleEnds ?? 'both';
      appearance.querySelector('[data-bubble-scale]').value = String(grid.bubbleScale ?? 1);
    },
    read(grid) {
      const next = structuredClone(grid);
      next.bubbleEnds = appearance.querySelector('[data-bubble-ends]').value;
      next.bubbleScale = Number(appearance.querySelector('[data-bubble-scale]').value);
      validateGridLabels(next);
      return next;
    },
  };
}
