import { cadFeedback, paintCanvasPointSnap } from './ui/cad-feedback.js';

import { TEMPLATE_KEYS } from './section-templates.js';

export function paintSectionEditor({
  ctx,
  width,
  height,
  scale,
  world,
  screen,
  evaluatedPoints,
  vertices: getVertices,
  drag,
  selected: selection,
  linkedPoints,
  draft,
  pointer,
  mode,
  def,
  evaluated,
  fmt,
  snapPoint,
}) {
  if (!ctx || !width) return;
  const c = ctx,
    w = width,
    h = height;
  c.clearRect(0, 0, w, h);
  c.fillStyle = '#f1f5f6';
  c.fillRect(0, 0, w, h);
  const target = 45 / scale,
    base = 10 ** Math.floor(Math.log10(target)),
    step = [1, 2, 5, 10].map((v) => v * base).find((v) => v >= target) || base * 10;
  const low = world([0, h]),
    high = world([w, 0]);
  c.lineWidth = 1;
  c.strokeStyle = '#dfe7e9';
  c.beginPath();
  for (let x = Math.ceil(low[0] / step) * step; x <= high[0]; x += step) {
    const p = screen([x, 0]);
    c.moveTo(p[0], 0);
    c.lineTo(p[0], h);
  }
  for (let y = Math.ceil(low[1] / step) * step; y <= high[1]; y += step) {
    const p = screen([0, y]);
    c.moveTo(0, p[1]);
    c.lineTo(w, p[1]);
  }
  c.stroke();
  const zero = screen([0, 0]);
  c.strokeStyle = '#a7babd';
  c.beginPath();
  c.moveTo(zero[0], 0);
  c.lineTo(zero[0], h);
  c.moveTo(0, zero[1]);
  c.lineTo(w, zero[1]);
  c.stroke();
  const loops = evaluatedPoints(),
    vertices = getVertices();
  let offset = 0;
  c.beginPath();
  loops.forEach((loop) => {
    loop.forEach((p, i) => {
      const v = vertices[offset + i],
        q = drag?.move && selection.includes(v?.id) ? p.map((x, j) => x + drag.offset[j]) : p,
        [x, y] = screen(q);
      if (!i) c.moveTo(x, y);
      else c.lineTo(x, y);
    });
    c.closePath();
    offset += loop.length;
  });
  c.fillStyle = '#509b8338';
  c.fill('evenodd');
  c.strokeStyle = '#28765f';
  c.lineWidth = 1.7;
  c.stroke();
  offset = 0;
  loops.forEach((loop) =>
    loop.forEach((p) => {
      const v = vertices[offset++],
        selected = selection.includes(v.id),
        linked = linkedPoints?.has(v.id),
        q = drag?.move && selected ? p.map((x, j) => x + drag.offset[j]) : p,
        [x, y] = screen(q);
      c.fillStyle = selected ? '#ef9144' : linked ? '#a3d9c5' : '#fff';
      c.strokeStyle = '#28765f';
      c.fillRect(x - 3, y - 3, 6, 6);
      c.strokeRect(x - 3, y - 3, 6, 6);
      if (selected || linked) {
        const label = 'P' + offset;
        c.font = 'bold 11px system-ui';
        c.lineWidth = 4;
        c.strokeStyle = '#f1f5f6';
        const labelX = x >= w / 2 ? x + 9 : x - 9 - c.measureText(label).labelWidth;
        c.strokeText(label, labelX, y - 8);
        c.fillStyle = selected ? '#a55214' : '#22664f';
        c.fillText(label, labelX, y - 8);
        c.lineWidth = 1.7;
        c.strokeStyle = '#28765f';
      }
    }),
  );
  if (draft.length) {
    c.beginPath();
    let pts = [...draft];
    if (pointer) {
      if (mode === 'rect') {
        const a = pts[0],
          b = pointer;
        pts = [a, [b[0], a[1]], b, [a[0], b[1]], a];
      } else pts.push(pointer);
    }
    pts.forEach((p, i) => {
      const [x, y] = screen(p);
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    });
    c.strokeStyle = cadFeedback.preview;
    c.stroke();
  }
  const dimensionHits = [];
  if (def.template && evaluated) {
    const b = evaluated.properties.bounds,
      lo = screen([b.minX, b.minY]),
      hi = screen([b.maxX, b.maxY]);
    c.strokeStyle = '#728b92';
    c.fillStyle = '#45626a';
    c.lineWidth = 1;
    c.font = '11px system-ui';
    const label = (key, x, y) => {
      const text = key + ' = ' + fmt(evaluated.parameters[key]),
        labelWidth = c.measureText(text).labelWidth + 12;
      x = Math.max(3, Math.min(w - labelWidth - 3, x));
      y = Math.max(3, Math.min(h - 25, y));
      c.fillStyle = '#ffffffed';
      c.fillRect(x, y, labelWidth, 22);
      c.strokeStyle = '#b8cbc8';
      c.strokeRect(x, y, labelWidth, 22);
      c.fillStyle = '#28634f';
      c.fillText(text, x + 6, y + 15);
      dimensionHits.push({ key, x, y, w: labelWidth });
    };
    const y = Math.min(h - 35, lo[1] + 27),
      x = Math.max(18, lo[0] - 30);
    c.beginPath();
    c.moveTo(lo[0], lo[1] + 8);
    c.lineTo(lo[0], y + 6);
    c.moveTo(hi[0], lo[1] + 8);
    c.lineTo(hi[0], y + 6);
    c.moveTo(lo[0], y);
    c.lineTo(hi[0], y);
    c.moveTo(lo[0] - 8, hi[1]);
    c.lineTo(x - 6, hi[1]);
    c.moveTo(lo[0] - 8, lo[1]);
    c.lineTo(x - 6, lo[1]);
    c.moveTo(x, hi[1]);
    c.lineTo(x, lo[1]);
    c.stroke();
    label(evaluated.parameters.D !== undefined ? 'D' : 'B', (lo[0] + hi[0]) / 2 - 30, y - 11);
    if (evaluated.parameters.H !== undefined) label('H', x - 30, (lo[1] + hi[1]) / 2 - 11);
    (TEMPLATE_KEYS[def.template] || [])
      .filter((k) => !['B', 'H', 'D'].includes(k))
      .forEach((key, i) => label(key, hi[0] + 18, hi[1] + i * 29));
  }
  const anchor = evaluated?.anchor;
  if (anchor) {
    const [x, y] = screen(anchor);
    c.strokeStyle = '#df883e';
    c.beginPath();
    c.arc(x, y, 6, 0, Math.PI * 2);
    c.moveTo(x - 10, y);
    c.lineTo(x + 10, y);
    c.moveTo(x, y - 10);
    c.lineTo(x, y + 10);
    c.stroke();
  }
  if (snapPoint) {
    paintCanvasPointSnap(c, screen(snapPoint));
  }
  if (drag?.box) {
    const { p, end } = drag;
    c.fillStyle = '#377cc11a';
    c.strokeStyle = '#377cc1';
    c.fillRect(p[0], p[1], end[0] - p[0], end[1] - p[1]);
    c.strokeRect(p[0], p[1], end[0] - p[0], end[1] - p[1]);
  }
  c.fillStyle = '#748d94';
  c.font = '11px system-ui';
  c.fillText(`Rutsteg ${fmt(step)} mm`, 12, h - 12);

  return dimensionHits;
}
