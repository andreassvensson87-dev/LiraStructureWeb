import { gridObjectId } from '../grid-objects.js';

export function installGridSelection({ actions, controllers, grid, project, tools }) {
  const setSelection = (...args) => actions.setSelection(...args);
  grid.overlay.classList.add('grid-model-interactive');
  grid.overlay.addEventListener('pointerdown', (e) => {
    if (controllers?.modelImportUI?.active()) return;
    if (tools.drawing || tools.operation || e.button !== 0) return;
    const bubble = grid.labels.find((label) => label.el === e.target);
    if (!bubble) return;
    const objectId = gridObjectId(project.grid, bubble.id);
    const object = project.objects.find((s) => s.type === 'gridline' && s.id === objectId);
    if (object && actions.isSelectable(object.id)) {
      e.preventDefault();
      e.stopPropagation();
      setSelection([object.id]);
    }
  });
}
