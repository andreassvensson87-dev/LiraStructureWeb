import { patternPositions } from './pattern.js';

/** Inspector-only illustration; model placement always uses the pure pattern definition. */
export function renderFastenerPattern(svg, group) {
  svg.replaceChildren();
  const points = patternPositions(group);
  const angle = (group.rotation * Math.PI) / 180;
  const rotated = points.map(({ x, y }) => [
    x * Math.cos(angle) - y * Math.sin(angle),
    x * Math.sin(angle) + y * Math.cos(angle),
  ]);
  const minX = Math.min(...rotated.map((p) => p[0])),
    maxX = Math.max(...rotated.map((p) => p[0]));
  const minY = Math.min(...rotated.map((p) => p[1])),
    maxY = Math.max(...rotated.map((p) => p[1]));
  const scale = Math.min(200 / Math.max(1, maxX - minX), 75 / Math.max(1, maxY - minY));
  const project = ([x, y]) => [
    35 + (200 - (maxX - minX) * scale) / 2 + (x - minX) * scale,
    100 - (75 - (maxY - minY) * scale) / 2 - (y - minY) * scale,
  ];
  const add = (tag, attrs, text) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text != null) node.textContent = text;
    svg.append(node);
  };
  const path = (d, extra = {}) =>
    add('path', { d, fill: 'none', stroke: 'currentColor', 'stroke-width': 0.7, ...extra });
  const label = (x, y, value) =>
    add(
      'text',
      { x, y, 'font-size': 9, 'text-anchor': 'middle', fill: 'currentColor' },
      String(value),
    );
  const dimension = (a, b, text, offset = 15) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      length = Math.hypot(dx, dy);
    if (length < 24) return;
    const nx = (-dy / length) * offset,
      ny = (dx / length) * offset;
    const p = [a[0] + nx, a[1] + ny],
      q = [b[0] + nx, b[1] + ny];
    path(`M${a}L${p}M${b}L${q}M${p}L${q}`);
    for (const [x, y] of [p, q]) path(`M${x - 2} ${y - 2}l4 4`);
    label((p[0] + q[0]) / 2, (p[1] + q[1]) / 2 - 3, text);
  };
  rotated.forEach((p, i) => {
    const [x, y] = project(p),
      stroke = i === 0 ? '#17654f' : 'currentColor';
    add('circle', { cx: x, cy: y, r: 4, fill: 'none', stroke });
    path(`M${x - 7} ${y}h14M${x} ${y - 7}v14`, { stroke });
  });
  if ((group.shape || 'array') === 'array') {
    if (group.columns <= 8)
      for (let i = 1; i < group.columns; i++)
        dimension(
          project(rotated[i - 1]),
          project(rotated[i]),
          Math.round((points[i].x - points[i - 1].x) * 1000) / 1000,
        );
    if (group.rows <= 6)
      for (let i = 1; i < group.rows; i++)
        dimension(
          project(rotated[(i - 1) * group.columns]),
          project(rotated[i * group.columns]),
          Math.round((points[i * group.columns].y - points[(i - 1) * group.columns].y) * 1000) /
            1000,
          -18,
        );
  }
  if (group.shape === 'circle') {
    const [cx, cy] = project([0, 0]);
    path(`M${cx - 4} ${cy}h8M${cx} ${cy - 4}v8`, { 'stroke-dasharray': '2 2' });
    label(140, 135, `Ø${group.diameter}`);
  }
  path('M265 120h20m-4-3 4 3-4 3M265 120v-20m-3 4 3-4 3 4');
  label(290, 124, 'X');
  label(265, 94, 'Y');
  return points.length;
}
