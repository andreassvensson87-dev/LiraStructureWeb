import { measurementLayout } from './measurement-layout.js';
const NS = 'http://www.w3.org/2000/svg';
const node = (tag, attrs) => {
  const element = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  return element;
};
/** Presentation only, always a noninteractive export-excluded helper layer. */
export function paintMeasurements(root, measures, project, pixelScale = 1) {
  const layer = node('g', {
    'data-annotation-helper': 'measurements',
    'aria-hidden': 'true',
    'pointer-events': 'none',
  });
  const occupied = [];
  for (const measure of measures.slice(0, 24)) {
    const layout = measurementLayout(measure, project, pixelScale);
    if (!layout) continue;
    const b = layout.bounds;
    if (occupied.some((a) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1])) continue;
    occupied.push(b);
    layer.append(
      node('path', {
        d: layout.lines.map(([a, b]) => `M${a}L${b}`).join(''),
        fill: 'none',
        stroke: '#718c86',
        'stroke-width': 1,
        'vector-effect': 'non-scaling-stroke',
      }),
    );
    const [x, y] = layout.center;
    const text = node('text', {
      x,
      y,
      transform: `rotate(${layout.angle} ${x} ${y})`,
      fill: '#526c65',
      'font-family': 'Arial',
      'font-size': layout.fontSize,
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      stroke: 'white',
      'stroke-opacity': 0.9,
      'stroke-width': 3 / pixelScale,
      'paint-order': 'stroke',
    });
    text.textContent = layout.label;
    layer.append(text);
  }
  root.append(layer);
  return layer;
}
