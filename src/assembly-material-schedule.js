import { instancePoint } from './frame-layout.js';
const NS = 'http://www.w3.org/2000/svg';
const node = (tag, attrs, text) => {
  const e = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) e.setAttribute(key, value);
  if (text !== undefined) e.textContent = text;
  return e;
};
export function materialScheduleHeight(table) {
  return 3 + 2.5 + table.rows.length * table.rowHeight + 21.5;
}
/** Prefer the space left of the title block; narrow sheets use the content area above it. */
export function materialSchedulePosition(table, paper, layout) {
  const height = materialScheduleHeight(table);
  const title = layout?.entities?.find(
    (e) => e.type === 'block' && /title|rithuvud/i.test(`${e.id} ${e.blockId}`),
  );
  if (title) {
    const [x, y] = instancePoint(title, layout);
    if (x - table.width >= (layout.contentArea?.[0] ?? 10) && paper[1] - y - height >= 0)
      return [x - table.width, paper[1] - y - height];
  }
  const area = layout?.contentArea;
  return [area?.[0] ?? 10, Math.max(area?.[1] ?? 10, (area?.[3] ?? paper[1] - 10) - height)];
}
export function appendMaterialSchedule(svg, table, assemblyId, count) {
  const [x, y] = table.settings.position;
  const g = node('g', {
    'data-assembly-schedule': assemblyId,
    transform: `translate(${x},${y})`,
    'font-family': 'Arial, sans-serif',
    'font-size': table.settings.textSize,
    fill: '#000',
    stroke: 'none',
  });
  const box = (x, y, width, height) =>
    g.append(
      node('rect', {
        x,
        y,
        width,
        height,
        fill: 'white',
        stroke: '#000',
        'stroke-width': 0.15,
      }),
    );
  let serial = 0;
  const text = (value, x, y, width, size, align = 'start') => {
    const id = `assembly-material-cell-${serial++}`;
    const clip = node('clipPath', { id });
    clip.append(
      node('rect', { x: x + 0.3, y, width: Math.max(0, width - 0.6), height: size * 1.5 }),
    );
    g.append(
      clip,
      node(
        'text',
        {
          x: align === 'end' ? x + width - 0.5 : align === 'middle' ? x + width / 2 : x + 0.5,
          y: y + size,
          'font-size': size,
          'text-anchor': align,
          'clip-path': `url(#${id})`,
        },
        value,
      ),
    );
  };
  box(0, 0, table.width, 3);
  text('MATERIALLISTAN NEDAN AVSER ETT ELEMENT', 0, 0.6, table.width, 1.3, 'middle');
  let left = 0;
  for (const column of table.columns) {
    box(left, 3, column.width, 2.5);
    text(column.title, left, 3.5, column.width, 1.12, 'middle');
    left += column.width;
  }
  const bottom = 5.5 + table.rows.length * table.rowHeight;
  // Continuous column borders, as in the DXF reference.
  left = 0;
  table.columns.forEach((column, j) => {
    box(left, 5.5, column.width, table.rows.length * table.rowHeight);
    table.rows.forEach((row, i) => {
      const top = 5.5 + i * table.rowHeight;
      const mark = column.id === 'mark';
      if (mark) {
        g.append(
          node('rect', {
            x: left + 0.5,
            y: top + 0.25,
            width: 3,
            height: 3,
            fill: 'none',
            stroke: '#000',
            'stroke-width': 0.15,
          }),
        );
      }
      text(
        table.values[i + 1][j],
        left + (mark ? 4 : 0),
        top + (table.rowHeight - table.settings.textSize) / 2 - 0.2,
        column.width - (mark ? 4 : 0),
        table.settings.textSize,
        ['material', 'quantity', 'length', 'weight'].includes(column.id) ? 'end' : 'start',
      );
    });
    left += column.width;
  });
  const scale = table.width / 110;
  const field = (start, width, top, height, label, value) => {
    box(start * scale, bottom + top, width * scale, height);
    text(label, start * scale, bottom + top + 0.3, width * scale, 1.12);
    text(value, start * scale, bottom + top + 2, width * scale, height > 5 ? 3 : 2.15);
  };
  const notes = table.settings.notes;
  const weight =
    table.totalWeight == null
      ? '—'
      : `${table.approximate ? 'ca ' : ''}${table.totalWeight.toLocaleString('sv-SE', { maximumFractionDigits: 1, useGrouping: false })}`;
  field(0, 10, 0, 21.5, '', '');
  for (const [i, label] of ['VÄNSTER', 'CENTRUM', 'HÖGER'].entries()) {
    text(label, 0, bottom + i * 7 + 0.5, 10 * scale, 1.12, 'middle');
    const cx = 5 * scale,
      cy = bottom + i * 7 + 3;
    g.append(
      node('path', {
        d: `M ${cx - 4 * scale} ${cy} h ${8 * scale} M ${cx} ${cy - 0.5} v 4 M ${cx - 0.7} ${cy + 3} l 0.7 0.7 l 0.7 -0.7`,
        fill: 'none',
        stroke: '#000',
        'stroke-width': 0.15,
      }),
    );
  }
  field(10, 13, 0, 6.5, 'TOTALT ANTAL', String(count));
  field(23, 38.5, 0, 6.5, 'VIKT PER ELEMENT (kg)', weight);
  field(61.5, 16, 0, 6.5, 'UT (BRAND)', notes.fire);
  field(77.5, 19, 0, 6.5, 'UTFÖRANDEKLASS', notes.execution);
  field(96.5, 13.5, 0, 6.5, 'KOMPL. OFP', notes.inspection);
  field(10, 13, 6.5, 5, 'TOLERANSKLASS', notes.tolerance);
  field(23, 87, 6.5, 5, 'ALLMÄNNA ANVISNINGAR', notes.instructions);
  field(10, 13, 11.5, 5, 'SVETSKLASS', notes.weldClass);
  field(23, 87, 11.5, 5, 'GENERELL SVETSANVISNING', notes.weldInstructions);
  field(10, 13, 16.5, 5, 'ROSTSKYDD', notes.protection);
  field(23, 12, 16.5, 5, 'FÖRBEH.GRAD', notes.preparation);
  field(35, 26.5, 16.5, 5, 'KULÖR', notes.colour);
  field(61.5, 48.5, 16.5, 5, 'ÖVRIG INFORMATION', notes.information);
  svg.append(g);
  return g;
}
