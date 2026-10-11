// Shared presentation; callers own geometry, coordinates and transactions.
export const gripPixels = { marker: 8, hit: 18 };
const NS = 'http://www.w3.org/2000/svg';
export function createSvgGrip({ point: [x, y], role = 'point', zoom = 1, key, label, attrs = {} }) {
  const group = document.createElementNS(NS, 'g');
  group.classList.add('cad-grip');
  group.dataset.gripRole = role;
  if (key) group.dataset.gripKey = key;
  group.setAttribute('aria-label', label);
  group.setAttribute('role', 'img');
  for (const [name, value] of Object.entries(attrs)) group.setAttribute(name, value);
  const title = document.createElementNS(NS, 'title');
  title.textContent = `${label} · dra eller klicka och placera · Esc avbryter`;
  group.append(title);
  const hit = document.createElementNS(NS, 'rect');
  hit.classList.add('cad-grip-hit');
  group.append(hit);
  const marker = document.createElementNS(NS, role === 'parameter' ? 'circle' : 'path');
  marker.classList.add('cad-grip-marker');
  marker.setAttribute('vector-effect', 'non-scaling-stroke');
  group.append(marker);
  group.dataset.gripX = x;
  group.dataset.gripY = y;
  updateSvgGrip(group, zoom);
  return group;
}
export function updateSvgGrip(group, zoom) {
  const x = Number(group.dataset.gripX),
    y = Number(group.dataset.gripY);
  const half = gripPixels.marker / (2 * zoom),
    hitHalf = gripPixels.hit / (2 * zoom);
  const hit = group.querySelector('.cad-grip-hit');
  for (const [name, value] of Object.entries({
    x: x - hitHalf,
    y: y - hitHalf,
    width: hitHalf * 2,
    height: hitHalf * 2,
  }))
    hit.setAttribute(name, value);
  const marker = group.querySelector('.cad-grip-marker');
  if (group.dataset.gripRole === 'parameter') {
    marker.setAttribute('cx', x);
    marker.setAttribute('cy', y);
    marker.setAttribute('r', half);
  } else
    marker.setAttribute(
      'd',
      group.dataset.gripRole === 'move'
        ? `M${x},${y - half}L${x + half},${y}L${x},${y + half}L${x - half},${y}Z`
        : `M${x - half},${y - half}h${2 * half}v${2 * half}h${-2 * half}Z`,
    );
}
export function createHtmlGrip({ role = 'point', key, label }) {
  const node = document.createElement('div');
  node.classList.add('cad-grip');
  node.dataset.gripRole = role;
  node.dataset.gripKey = key;
  node.setAttribute('aria-label', label);
  node.title = `${label} · dra eller klicka och placera · Esc avbryter`;
  return node;
}

export function updateScreenGrips(root) {
  for (const node of root.querySelectorAll('g.cad-grip')) {
    const matrix = node.getScreenCTM();
    if (matrix) updateSvgGrip(node, Math.max(1e-9, Math.hypot(matrix.a, matrix.b)));
  }
}
