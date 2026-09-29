/** Position menus against the viewport, independently of the dialog's content height. */
export function positionDrawingMenu(trigger, panel) {
  const bounds = trigger.getBoundingClientRect();
  const margin = 8,
    gap = 6;
  const width = document.documentElement.clientWidth;
  const height = window.innerHeight;
  const below = Math.max(0, height - bounds.bottom - gap - margin);
  const above = Math.max(0, bounds.top - gap - margin);
  const down = below >= Math.min(panel.scrollHeight, 320) || below >= above;
  Object.assign(panel.style, {
    position: 'fixed',
    right: 'auto',
    bottom: 'auto',
    maxWidth: `${width - 2 * margin}px`,
    minWidth: `${Math.min(230, width - 2 * margin)}px`,
    maxHeight: `${down ? below : above}px`,
    overflowY: 'auto',
    boxSizing: 'border-box',
  });
  const size = panel.getBoundingClientRect();
  panel.style.left = `${Math.max(margin, Math.min(bounds.left, width - size.width - margin))}px`;
  panel.style.top = `${down ? bounds.bottom + gap : Math.max(margin, bounds.top - gap - size.height)}px`;
}
