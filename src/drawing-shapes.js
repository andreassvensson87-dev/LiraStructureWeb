export const shapeNames = {
  line: 'Linje',
  polyline: 'Polylinje',
  polygon: 'Polygon',
  circle: 'Cirkel',
  rectangle: 'Rektangel',
  arc: 'Båge',
};

export function shapeSnapPoints(item) {
  if (item.shape === 'rectangle' && item.points.length === 2) {
    const [a, b] = item.points;
    return [a, [b[0], a[1]], b, [a[0], b[1]]];
  }
  return item.points;
}

export function arcGeometry([a, b, c]) {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  if (Math.abs(d) < 1e-7) throw Error('Välj tre punkter som inte ligger på samma linje.');
  const squared = (p) => p[0] ** 2 + p[1] ** 2;
  const center = [
    (squared(a) * (b[1] - c[1]) + squared(b) * (c[1] - a[1]) + squared(c) * (a[1] - b[1])) / d,
    (squared(a) * (c[0] - b[0]) + squared(b) * (a[0] - c[0]) + squared(c) * (b[0] - a[0])) / d,
  ];
  const radius = Math.hypot(a[0] - center[0], a[1] - center[1]);
  const angle = (p) => Math.atan2(p[1] - center[1], p[0] - center[0]);
  const wrap = (v) => (v + 2 * Math.PI) % (2 * Math.PI);
  const start = angle(a),
    ccw = wrap(angle(c) - start);
  const sweep = wrap(angle(b) - start) <= ccw ? ccw : ccw - 2 * Math.PI;
  return { center, radius, start, sweep };
}

export function validateShape(shape, points, closed = false) {
  if (!Array.isArray(points) || points.some((p) => p.length !== 2 || !p.every(Number.isFinite)))
    throw Error('Ange giltiga koordinater.');
  const min = shape === 'arc' || shape === 'polygon' || closed ? 3 : 2;
  if (points.length < min) throw Error(`Välj minst ${min} punkter.`);
  if (Math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1]) < 1e-7)
    throw Error('Välj två olika punkter.');
  if (
    shape === 'rectangle' &&
    (Math.abs(points[1][0] - points[0][0]) < 1e-7 || Math.abs(points[1][1] - points[0][1]) < 1e-7)
  )
    throw Error('Rektangeln behöver både bredd och höjd.');
  if (shape === 'arc') arcGeometry(points);
  if (shape === 'polygon' || closed) {
    const area = points.reduce((sum, a, i) => {
      const b = points[(i + 1) % points.length];
      return sum + a[0] * b[1] - b[0] * a[1];
    }, 0);
    if (Math.abs(area) < 1e-7) throw Error('Polygonen måste ha en yta.');
    const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    for (let i = 0; i < points.length; i++)
      for (let j = i + 2; j < points.length; j++) {
        if (i === 0 && j === points.length - 1) continue;
        const a = points[i],
          b = points[(i + 1) % points.length],
          c = points[j],
          d = points[(j + 1) % points.length];
        if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0)
          throw Error('Polygonens kanter får inte korsa varandra.');
      }
  }
}

// Project points before generating SVG: the same geometry is used on screen and in PDF.
export function shapePath(shape, points, project) {
  if (points.length < 2) return '';
  const projected = points.map(project);
  if (shape === 'circle') {
    const [c, edge] = projected,
      r = Math.hypot(edge[0] - c[0], edge[1] - c[1]);
    return `M${c[0] - r},${c[1]}a${r},${r} 0 1 0 ${2 * r},0a${r},${r} 0 1 0 ${-2 * r},0`;
  }
  if (shape === 'rectangle') {
    const [a, b] = points;
    const corners = [a, [b[0], a[1]], b, [a[0], b[1]]].map(project);
    return `M${corners.join('L')}Z`;
  }
  if (shape === 'arc' && points.length >= 3) {
    const { center, radius, start, sweep } = arcGeometry(points);
    // Short segments also support mirrored/transformed drawing views.
    const count = Math.max(16, Math.ceil(Math.abs(sweep) * 32));
    const curve = Array.from({ length: count + 1 }, (_, i) => {
      const angle = start + (sweep * i) / count;
      return project([center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)]);
    });
    return `M${curve.join('L')}`;
  }
  return `M${projected.join('L')}`;
}

// Boundaries in object coordinates. Hatch spacing is applied after paper projection.
export function shapeContours(item) {
  if (item.shape === 'circle' && item.points.length === 2) {
    const [c, e] = item.points,
      r = Math.hypot(e[0] - c[0], e[1] - c[1]);
    return [
      Array.from({ length: 128 }, (_, i) => {
        const a = (i * Math.PI * 2) / 128;
        return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
      }),
    ];
  }
  if (item.shape === 'rectangle') return [shapeSnapPoints(item)];
  return item.closed || item.shape === 'polygon' ? [item.points] : [];
}
