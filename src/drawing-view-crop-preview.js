// Screen-space outline only; view geometry and snap indexes stay untouched while dragging.
export function createViewCropPreview({ host, paper, paperSize }) {
  const box = document.createElement('div');
  box.className = 'drawing-placement-preview';
  box.hidden = true;
  box.setAttribute('aria-hidden', 'true');
  host.append(box);
  return {
    paint(view) {
      box.hidden = false;
      const rect = paper.getBoundingClientRect(),
        origin = host.getBoundingClientRect();
      const scale = rect.width / paperSize()[0];
      Object.assign(box.style, {
        left: rect.left - origin.left + host.scrollLeft + view.position[0] * scale + 'px',
        top: rect.top - origin.top + host.scrollTop + view.position[1] * scale + 'px',
        width: view.size[0] * scale + 'px',
        height: view.size[1] * scale + 'px',
      });
    },
    remove() {
      box.remove();
    },
  };
}
