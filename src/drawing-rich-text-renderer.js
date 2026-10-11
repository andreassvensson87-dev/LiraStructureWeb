import { createSvgGrip } from './ui/grip.js';
const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs, text) => {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (attrs['font-family']) node.style.fontFamily = attrs['font-family'];
  if (text !== undefined) node.textContent = text;
  return node;
};

export function paintDrawingText(
  layer,
  item,
  layout,
  selected = false,
  helperRoot = layer,
  zoom = 1,
) {
  const [x, y] = item.points[0];
  const group = svg('g', {
    'data-annotation': item.id,
    'data-rich-text': item.id,
    transform: `rotate(${item.rotation || 0} ${x} ${y})`,
  });
  layer.append(group);
  group.append(
    svg('rect', {
      x,
      y,
      width: item.width,
      height: layout.height,
      fill: item.background ? 'white' : 'transparent',
      stroke: item.frame ? '#263a42' : 'none',
      'stroke-width': 0.22,
      'pointer-events': 'all',
    }),
  );
  for (const [index, line] of layout.lines.entries()) {
    const left =
      x +
      line.indent +
      (line.align === 'center'
        ? (item.width - line.indent - line.width) / 2
        : line.align === 'right'
          ? item.width - line.indent - line.width
          : 0);
    const text = svg('text', {
      x: left,
      y: y + layout.size + index * layout.spacing,
      'font-size': layout.size,
      'font-family': item.font,
      fill: '#263a42',
      stroke: 'none',
      'xml:space': 'preserve',
    });
    if (line.prefix)
      group.append(
        svg(
          'text',
          {
            x,
            y: y + layout.size + index * layout.spacing,
            'font-size': layout.size,
            'font-family': item.font,
            fill: '#263a42',
          },
          line.prefix,
        ),
      );
    for (const run of line.runs)
      text.append(
        svg(
          'tspan',
          {
            'font-weight': run.bold ? 'bold' : 'normal',
            'font-style': run.italic ? 'italic' : 'normal',
            'text-decoration': run.underline ? 'underline' : 'none',
          },
          run.text,
        ),
      );
    group.append(text);
  }
  if (selected) {
    const helpers = svg('g', {
      'data-annotation': item.id,
      'data-rich-text': item.id,
      'data-annotation-helper': 'selection',
      transform: `rotate(${item.rotation || 0} ${x} ${y})`,
    });
    helperRoot.append(helpers);
    helpers.append(
      svg('rect', {
        x,
        y,
        width: item.width,
        height: layout.height,
        fill: 'none',
        stroke: '#287c65',
        'stroke-width': 1,
        'vector-effect': 'non-scaling-stroke',
        'data-annotation-helper': '',
      }),
    );
    helpers.append(
      createSvgGrip({
        point: [x + item.width, y + layout.height / 2],
        role: 'parameter',
        zoom,
        key: `${item.id}:text:width`,
        label: 'Ändra textbredden',
        attrs: { 'data-rich-width': '' },
      }),
      createSvgGrip({
        point: [x, y],
        role: 'move',
        zoom,
        key: `${item.id}:text:move`,
        label: 'Flytta texten',
        attrs: { 'data-rich-move': '' },
      }),
    );
  }
}
