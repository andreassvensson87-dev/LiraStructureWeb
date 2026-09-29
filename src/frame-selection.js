// Geometry is measured in screen pixels, including rotated text and block instances.
export function rectangleSelection(shapes, start, end) {
  const min = [Math.min(start[0], end[0]), Math.min(start[1], end[1])],
    max = [Math.max(start[0], end[0]), Math.max(start[1], end[1])],
    crossing = end[0] < start[0];
  const inside = (p) => p.every((v, i) => v >= min[i] - 1e-7 && v <= max[i] + 1e-7);
  const segment = (a, b) => {
    let lo = 0,
      hi = 1;
    for (let i = 0; i < 2; i++) {
      const d = b[i] - a[i];
      if (Math.abs(d) < 1e-10) {
        if (a[i] < min[i] || a[i] > max[i]) return false;
      } else {
        const t1 = (min[i] - a[i]) / d,
          t2 = (max[i] - a[i]) / d;
        lo = Math.max(lo, Math.min(t1, t2));
        hi = Math.min(hi, Math.max(t1, t2));
        if (lo > hi) return false;
      }
    }
    return true;
  };
  const contains = (points, p) => {
    let hit = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i],
        b = points[j];
      if (
        a[1] > p[1] !== b[1] > p[1] &&
        p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
      )
        hit = !hit;
    }
    return hit;
  };
  const groups = new Map();
  for (const shape of shapes) {
    if (!groups.has(shape.id)) groups.set(shape.id, []);
    groups.get(shape.id).push(shape);
  }
  return [...groups]
    .filter(([, parts]) =>
      crossing
        ? parts.some(
            ({ points, closed }) =>
              points.some(inside) ||
              points.some((p, i) => i > 0 && segment(points[i - 1], p)) ||
              (closed && (segment(points.at(-1), points[0]) || contains(points, min))),
          )
        : parts.every(({ points }) => points.length && points.every(inside)),
    )
    .map(([id]) => id);
}
export function frameSelectionShapes(root) {
  return [...root.querySelectorAll('[data-entity]')].flatMap((group) => {
    const element = group.querySelector('polyline,text,image');
    if (!element) return [];
    const matrix = element.getScreenCTM();
    if (!matrix) return [];
    const closed = element.tagName !== 'polyline';
    let points;
    if (!closed) points = [...element.points].map((p) => [p.x, p.y]);
    else {
      const b = element.getBBox();
      points = [
        [b.x, b.y],
        [b.x + b.width, b.y],
        [b.x + b.width, b.y + b.height],
        [b.x, b.y + b.height],
      ];
    }
    return [
      {
        id: group.dataset.entity,
        closed,
        points: points.map(([x, y]) => [
          matrix.a * x + matrix.c * y + matrix.e,
          matrix.b * x + matrix.d * y + matrix.f,
        ]),
      },
    ];
  });
}
