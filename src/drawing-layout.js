import { FRAME_LIBRARY_KEY, attributeValue } from './frame-model.js';
import { LAYOUT_KEY, expandLayout } from './frame-layout.js';
const NS = 'http://www.w3.org/2000/svg';
export function readDrawingLayouts() {
  try {
    return JSON.parse(localStorage.getItem(LAYOUT_KEY) || '[]');
  } catch {
    return [];
  }
}
export function findDrawingLayout(id) {
  return readDrawingLayouts().find((l) => l.id === id) || null;
}
export function layoutPicker(parent, id, onChange) {
  const label = document.createElement('label');
  label.textContent = 'Layout';
  const select = document.createElement('select');
  select.id = id;
  label.append(select);
  parent.prepend(label);
  select.onchange = () => onChange(select.value);
  return select;
}
export function fillLayoutPicker(select, id) {
  select.replaceChildren(
    new Option('Ingen layout', ''),
    ...readDrawingLayouts().map((l) => new Option(l.name, l.id)),
  );
  if (id && !findDrawingLayout(id)) select.add(new Option('Layout saknas', id));
  select.value = id || '';
}
export function appendDrawingLayout(svg, layout, context) {
  if (!layout) return;
  let blocks = [];
  try {
    blocks = JSON.parse(localStorage.getItem(FRAME_LIBRARY_KEY) || '[]');
  } catch {}
  const node = (tag, attrs, text) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const root = node('g', {
    'data-drawing-layout': layout.id,
    transform: `translate(0 ${layout.height}) scale(1 -1)`,
    'pointer-events': 'none',
  });
  svg.append(root);
  for (const e of expandLayout(layout, blocks)) {
    if (e.type === 'line') {
      root.append(
        node('polyline', {
          points: e.points.map((p) => p.join(',')).join(' '),
          fill: 'none',
          stroke: e.color || '#233940',
          'stroke-width': e.stroke,
        }),
      );
      continue;
    }
    const group = node('g', {
      transform: `translate(${e.point.join(' ')}) rotate(${e.angle || 0}) scale(1 -1)`,
    });
    root.append(group);
    if (e.type === 'image')
      group.append(
        node('image', { href: e.src, x: 0, y: -e.height, width: e.width, height: e.height }),
      );
    else
      group.append(
        node(
          'text',
          {
            'font-family': e.font || 'Arial, sans-serif',
            'font-size': e.size,
            'text-anchor': e.align,
            fill: e.color || '#233940',
          },
          e.type === 'attribute' ? attributeValue(e.key, context) : e.text,
        ),
      );
  }
}
export function drawingLayoutStamp(id) {
  const layout = findDrawingLayout(id);
  if (!layout) return id ? { missing: id } : null;
  let blocks = [];
  try {
    blocks = JSON.parse(localStorage.getItem(FRAME_LIBRARY_KEY) || '[]');
  } catch {}
  const ids = new Set(layout.entities.map((e) => e.blockId));
  return { layout, blocks: blocks.filter((b) => ids.has(b.id)) };
}
