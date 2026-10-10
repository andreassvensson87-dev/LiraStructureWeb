export function installGridSelection({ actions, grid, project, tools }) {
  const setSelection = (...args) => actions.setSelection(...args);
  grid.overlay.classList.add('grid-model-interactive');
  grid.overlay.addEventListener('pointerdown', (e) => {
    if (tools.drawing || tools.operation || e.button !== 0) return;
    const bubble = grid.labels.find((label) => label.el === e.target);
    if (!bubble) return;
    const object = project.objects.find((s) => s.type === 'gridline' && s.gridPickId === bubble.id);
    if (object) {
      e.preventDefault();
      e.stopPropagation();
      setSelection([object.id]);
    }
  });
}
