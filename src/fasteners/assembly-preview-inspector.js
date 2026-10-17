import { fastenerAccessories } from './accessories.js';
import { cadFeedback } from '../ui/cad-feedback.js';

const NS = 'http://www.w3.org/2000/svg';
const node = (tag, attributes) => {
  const element = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
};

/** A section of one resolved screw. Uses its actual layers and fitted hardware offsets. */
export function paintFastenerAssemblyPreview(svg, source) {
  svg.replaceChildren();
  svg.setAttribute('viewBox', '0 0 310 105');
  const { spec } = source;
  const hardware = fastenerAccessories(source);
  const layers = source.holes.flatMap((h) =>
    h.active === false || h.kind === 'none' ? [] : h.layers || [],
  );
  const head = source.assembly?.bolt !== false && spec.head ? spec.head.height : 0;
  const lo = Math.min(-head, ...hardware.map((h) => h.offset));
  const hi = Math.max(spec.length, ...hardware.map((h) => h.offset + spec[h.kind].thickness));
  const scale = 242 / Math.max(1, hi - lo);
  const x = (offset) => 26 + (offset - lo) * scale;
  const diameter = Math.max(
    spec.diameter,
    spec.head?.diameter || 0,
    ...hardware.map((h) => spec[h.kind].outerDiameter || spec[h.kind].acrossFlats),
  );
  const yScale = Math.min(scale, 44 / diameter);
  const radius = Math.max(2, (spec.diameter * yScale) / 2);
  const group = node(
    'g',
    source.layout?.reversed ? { transform: 'translate(310 0) scale(-1 1)' } : {},
  );
  svg.append(group);
  const line = (x1, y1, x2, y2, color = 'currentColor') => {
    group.append(node('line', { x1, y1, x2, y2, stroke: color, 'stroke-width': 0.8 }));
  };
  const rect = (offset, length, top, height, fill, stroke = 'currentColor') => {
    group.append(
      node('rect', {
        x: x(offset),
        y: top,
        width: Math.max(0.5, length * scale),
        height,
        fill,
        stroke,
        'stroke-width': 0.8,
      }),
    );
  };
  const axis = node('path', { d: 'M8 46H298', class: 'assembly-axis' });
  group.append(axis);
  for (const layer of layers) {
    for (const [top, bottom] of [
      [18, 46 - radius],
      [46 + radius, 74],
    ]) {
      if (bottom <= top) continue;
      rect(layer.offset, layer.depth, top, bottom - top, '#f3f6f7');
      // Clip each small hatch explicitly, with no shared SVG IDs between inspectors.
      const start = x(layer.offset),
        end = x(layer.offset + layer.depth);
      for (let k = start - (bottom - top); k < end; k += 6) {
        const a = Math.max(start, k),
          b = Math.min(end, k + bottom - top);
        if (b > a) line(a, bottom - (a - k), b, bottom - (b - k), '#9cacb2');
      }
    }
    for (const offset of [layer.offset, layer.offset + layer.depth])
      line(x(offset), 46 - radius - 2, x(offset), 46 + radius + 2, cadFeedback.preview);
  }
  if (source.assembly?.bolt !== false) {
    rect(0, spec.length, 46 - radius, radius * 2, '#edf3f0');
    if (head) {
      const r = ((spec.head.diameter || spec.diameter) * yScale) / 2;
      if (spec.head.kind === 'countersunk')
        group.append(
          node('path', {
            d: `M${x(-head)} ${46 - r}L${x(0)} ${46 - radius}V${46 + radius}L${x(-head)} ${46 + r}Z`,
            fill: '#edf3f0',
            stroke: 'currentColor',
          }),
        );
      else rect(-head, head, 46 - r, r * 2, '#edf3f0');
    }
  }
  for (const item of hardware) {
    const part = spec[item.kind];
    const r = ((part.outerDiameter || part.acrossFlats) * yScale) / 2;
    rect(item.offset, part.thickness, 46 - r, r * 2, '#edf3f0');
  }
  const tip = 294;
  line(275, 46, tip, 46, cadFeedback.axisZ);
  line(tip - 5, 43, tip, 46, cadFeedback.axisZ);
  line(tip - 5, 49, tip, 46, cadFeedback.axisZ);
  line(x(0), 84, x(spec.length), 84);
  for (const offset of [0, spec.length]) line(x(offset), 80, x(offset), 88);
  const text = node('text', {
    x: 155,
    y: 101,
    'text-anchor': 'middle',
    fill: 'currentColor',
    'font-size': 11,
  });
  text.textContent = String(Math.round(spec.length));
  svg.append(text);
  svg.setAttribute(
    'aria-label',
    `Första skruven i snitt · längd ${Math.round(spec.length)} · ${layers.length} lager`,
  );
}
