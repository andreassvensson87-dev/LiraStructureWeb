import { viewOrientation } from '../view-orientation.js';

export function createViewWidget(host, camera, onAxis) {
  const root = document.createElement('nav');
  root.className = 'view-widget';
  root.setAttribute('aria-label', 'Koordinatindikator och axelvyer');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 96 96');
  svg.setAttribute('aria-hidden', 'true');
  root.append(svg);
  const directions = () => viewOrientation(camera).filter(({ sign }) => sign > 0);
  const entries = directions().map(({ axis }) => {
    const label = `+${axis}`,
      button = document.createElement('button'),
      line = document.createElementNS(svg.namespaceURI, 'line');
    button.type = 'button';
    button.textContent = label;
    button.title = `Visa modellen från ${label}`;
    button.setAttribute('aria-label', `Visa från ${label}`);
    button.setAttribute('aria-pressed', 'false');
    button.dataset.viewAxis = label;
    button.className = `view-axis view-axis-${axis.toLowerCase()}`;
    line.setAttribute('class', `view-axis-line view-axis-${axis.toLowerCase()}`);
    line.setAttribute('x1', '48');
    line.setAttribute('y1', '48');
    svg.append(line);
    root.append(button);
    button.onclick = () => onAxis(axis, 1);
    return { button, line };
  });
  // Overlay interactions belong to the widget, including when a model tool is active.
  for (const event of ['pointerdown', 'pointerup', 'click', 'dblclick', 'contextmenu'])
    root.addEventListener(event, (e) => e.stopPropagation());
  host.append(root);
  function update() {
    directions().forEach(({ x, y, depth }, i) => {
      const { button, line } = entries[i],
        left = 48 + x * 32,
        top = 48 + y * 32;
      button.style.left = `${left}px`;
      button.style.top = `${top}px`;
      button.style.zIndex = String(Math.round((depth + 1) * 10) + 1);
      button.setAttribute('aria-pressed', String(depth > 0.999));
      line.setAttribute('x2', String(left));
      line.setAttribute('y2', String(top));
      line.style.opacity = depth < 0 ? '0.3' : '0.6';
    });
  }
  update();
  return { update, dispose: () => root.remove() };
}
