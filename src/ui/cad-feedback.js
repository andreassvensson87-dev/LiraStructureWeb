// Presentation only. Callers provide snap results and projected coordinates.
export const cadFeedback = Object.freeze({
  snap: '#d000b8',
  nearestEdge: '#20aaba',
  preview: '#28946d',
  previewOpacity: 0.65,
  rubberBand: '#a6b3ba',
  tracking: '#16815e',
  polar: '#bc873b',
  axisX: '#bb534d',
  axisY: '#328975',
  axisZ: '#397dc5',
  markerPixels: 10,
  dashPixels: [5, 4],
});
const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs) => {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
};
export function snapSymbol(kind, symbol) {
  if (symbol) return symbol;
  return (
    {
      Ändpunkt: 'square',
      Mittpunkt: 'midpoint',
      Centrum: 'circle',
      Korsning: 'cross',
      Skärning: 'cross',
      Vinkelrät: 'perpendicular',
      Kvadrant: 'diamond',
      Närmaste: 'line',
    }[kind] || 'square'
  );
}
// Canvas editor's endpoint snap uses the same square and screen dimensions.
export function paintCanvasPointSnap(context, [x, y]) {
  context.save();
  context.strokeStyle = cadFeedback.snap;
  context.lineWidth = 1.5;
  const size = cadFeedback.markerPixels;
  context.strokeRect(x - size / 2, y - size / 2, size, size);
  context.restore();
}
export function paintCadSnap(
  root,
  point,
  { kind, symbol, pixelScale = 1, label, marker = true } = {},
) {
  const shape = snapSymbol(kind, symbol),
    k = 1 / Math.max(pixelScale, 1e-9),
    r = (cadFeedback.markerPixels * k) / 2,
    [x, y] = point;
  const group = svg('g', {
    'data-cad-snap': shape,
    'pointer-events': 'none',
    stroke: cadFeedback.snap,
    fill: 'none',
    'stroke-width': 1.5,
  });
  const attrs = { 'vector-effect': 'non-scaling-stroke' };
  let path;
  if (marker && shape === 'circle') group.append(svg('circle', { ...attrs, cx: x, cy: y, r }));
  else if (marker) {
    if (shape === 'midpoint') path = `M${x},${y - r}L${x + r},${y + r}L${x - r},${y + r}Z`;
    else if (shape === 'diamond')
      path = `M${x},${y - r}L${x + r},${y}L${x},${y + r}L${x - r},${y}Z`;
    else if (shape === 'cross')
      path = `M${x - r},${y - r}L${x + r},${y + r}M${x - r},${y + r}L${x + r},${y - r}`;
    else if (shape === 'perpendicular')
      path = `M${x - r},${y - r}v${2 * r}h${2 * r}M${x - r},${y}h${r}v${r}`;
    else if (shape === 'line') path = `M${x},${y - r}v${2 * r}M${x - r},${y + r}h${2 * r}`;
    else path = `M${x - r},${y - r}h${2 * r}v${2 * r}h${-2 * r}Z`;
    group.append(svg('path', { ...attrs, d: path }));
  }
  if (label) {
    const text = svg('text', {
      x: x + 10 * k,
      y: y - 10 * k,
      fill: '#52666f',
      stroke: 'white',
      'stroke-width': 3 * k,
      'paint-order': 'stroke',
      'font-size': 11 * k,
      'font-family': 'Arial',
    });
    text.textContent = label;
    group.append(text);
  }
  root.append(group);
  return group;
}
export function paintCadGuide(
  root,
  a,
  b,
  { role = 'rubberBand', pixelScale = 1, dashed = false } = {},
) {
  const node = svg('path', {
    d: `M${a}L${b}`,
    stroke: cadFeedback[role],
    fill: 'none',
    'stroke-width': 1,
    'vector-effect': 'non-scaling-stroke',
    'pointer-events': 'none',
    'stroke-dasharray': dashed ? cadFeedback.dashPixels.map((v) => v / pixelScale).join(' ') : '',
  });
  root.append(node);
  return node;
}

/** Paint only the boundary owned by the winning Nearest candidate. */
export function paintCadNearestEdge(root, snap, project = (p) => p) {
  if (!snap?.snapEdge || ![snap.kind, snap.label].includes('Närmaste')) return null;
  const edge = snap.snapEdge;
  const points =
    edge.points ||
    Array.from({ length: 145 }, (_, index) => {
      const angle = edge.start + (edge.sweep * index) / 144;
      return [
        edge.center[0] + edge.radius * Math.cos(angle),
        edge.center[1] + edge.radius * Math.sin(angle),
      ];
    });
  const projected = points.map(project);
  if (projected.length < 2 || projected.some((p) => !p || !p.every(Number.isFinite))) return null;
  const path = svg('path', {
    d: `M${projected.map((p) => p.join(',')).join('L')}`,
    fill: 'none',
    stroke: cadFeedback.nearestEdge,
    'stroke-width': 2,
    'vector-effect': 'non-scaling-stroke',
    'pointer-events': 'none',
    'data-cad-nearest-edge': '',
  });
  root.append(path);
  return path;
}
