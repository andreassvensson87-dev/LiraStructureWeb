/** Shared profile-library and conversion thumbnail. Input is an evaluated section. */
export function renderProfilePreview(svg, section) {
  const points = section.loops.flat(),
    xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]),
    x = Math.min(...xs),
    y = Math.min(...ys),
    width = Math.max(...xs) - x,
    height = Math.max(...ys) - y,
    pad = Math.max(width, height) * 0.15 || 10;
  svg.setAttribute(
    'viewBox',
    `${x - pad} ${-y - height - pad} ${width + 2 * pad} ${height + 2 * pad}`,
  );
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute(
    'd',
    section.loops.map((loop) => 'M' + loop.map(([a, b]) => `${a},${-b}`).join('L') + 'Z').join(''),
  );
  path.setAttribute('fill-rule', 'evenodd');
  svg.replaceChildren(path);
  return { width, height };
}
