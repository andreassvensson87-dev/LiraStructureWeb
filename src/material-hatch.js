export const HATCH_PATTERNS = [
  ['none', 'Ingen'],
  ['diagonal', 'Diagonala linjer'],
  ['cross', 'Korshatchning'],
  ['concrete', 'Betong'],
  ['wood', 'Trä'],
  ['insulation', 'Isolering'],
];
export function materialHatch(material) {
  return (
    material?.hatch || {
      pattern:
        { steel: 'diagonal', concrete: 'concrete', wood: 'wood', insulation: 'insulation' }[
          material?.category
        ] || 'none',
      angle: material?.category === 'steel' ? 45 : 0,
      spacing: 2.5,
      lineWidth: 0.18,
    }
  );
}
export function validateHatch(hatch) {
  if (
    !hatch ||
    !HATCH_PATTERNS.some(([key]) => key === hatch.pattern) ||
    !Number.isFinite(hatch.angle) ||
    Math.abs(hatch.angle) > 360 ||
    !Number.isFinite(hatch.spacing) ||
    hatch.spacing < 0.5 ||
    hatch.spacing > 100 ||
    !Number.isFinite(hatch.lineWidth) ||
    hatch.lineWidth < 0.05 ||
    hatch.lineWidth > 2
  )
    throw Error(
      'Ange giltigt sektionsmönster, vinkel, avstånd (0,5–100 mm) och linjetjocklek (0,05–2 mm).',
    );
  return hatch;
}

// Only closed boundaries can describe a cut face. Quantization joins triangle seams.
export function sectionContours(segments) {
  const key = (p) => p.map((n) => Math.round(n / 1e-4)).join(',');
  const edges = new Map(),
    vertices = new Map();
  for (const [a, b] of segments) {
    const ka = key(a),
      kb = key(b),
      id = [ka, kb].sort().join('|');
    if (ka === kb || edges.has(id)) continue;
    edges.set(id, [ka, kb]);
    for (const [k, p] of [
      [ka, a],
      [kb, b],
    ]) {
      if (!vertices.has(k)) vertices.set(k, { point: p, edges: [] });
      vertices.get(k).edges.push(id);
    }
  }
  const used = new Set(),
    contours = [];
  for (const [id, [start]] of edges) {
    if (used.has(id)) continue;
    const points = [];
    let current = start,
      edge = id,
      closed = false;
    while (edge && !used.has(edge)) {
      used.add(edge);
      points.push(vertices.get(current).point);
      const pair = edges.get(edge);
      current = pair[0] === current ? pair[1] : pair[0];
      if (current === start) {
        closed = true;
        break;
      }
      edge = vertices.get(current).edges.find((e) => !used.has(e));
    }
    if (closed && points.length >= 3) contours.push(points);
  }
  return contours;
}
export function clipContours(contours, span) {
  if (!span) return contours;
  const dot = (p) => p[0] * span.direction[0] + p[1] * span.direction[1];
  return contours
    .map((polygon) => {
      for (const distance of [(p) => dot(p), (p) => span.length - dot(p)]) {
        const out = [];
        for (let i = 0; i < polygon.length; i++) {
          const a = polygon[i],
            b = polygon[(i + 1) % polygon.length],
            da = distance(a),
            db = distance(b);
          if (da >= 0) out.push(a);
          if (da >= 0 !== db >= 0) out.push(a.map((n, j) => n + ((b[j] - n) * da) / (da - db)));
        }
        polygon = out;
      }
      return polygon;
    })
    .filter((p) => p.length >= 3);
}

// Pattern spacing is in paper millimetres. Even/odd intersections retain inner holes.
export function hatchSegments(contours, hatch) {
  validateHatch(hatch);
  if (!contours.length || hatch.pattern === 'none') return [];
  const angle = (hatch.angle * Math.PI) / 180,
    c = Math.cos(angle),
    s = Math.sin(angle);
  const rotate = ([x, y]) => [x * c - y * s, x * s + y * c];
  const inverse = ([x, y]) => [x * c + y * s, -x * s + y * c];
  const rings = contours.map((ring) => ring.map(inverse));
  const points = rings.flat(),
    xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const edges = rings.flatMap((ring) => ring.map((a, i) => [a, ring[(i + 1) % ring.length]]));
  const result = [],
    spacing = hatch.spacing;
  function clip(a, b) {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      ts = [0, 1];
    for (const [p, q] of edges) {
      const ex = q[0] - p[0],
        ey = q[1] - p[1],
        den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-10) continue;
      const px = p[0] - a[0],
        py = p[1] - a[1],
        t = (px * ey - py * ex) / den,
        u = (px * dy - py * dx) / den;
      if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
    }
    ts.sort((a, b) => a - b);
    for (let i = 1; i < ts.length; i++) {
      if (ts[i] - ts[i - 1] < 1e-9) continue;
      const t = (ts[i] + ts[i - 1]) / 2,
        x = a[0] + dx * t,
        y = a[1] + dy * t;
      let inside = false;
      for (const [p, q] of edges)
        if (p[1] > y !== q[1] > y && x < ((q[0] - p[0]) * (y - p[1])) / (q[1] - p[1]) + p[0])
          inside = !inside;
      if (inside)
        result.push([
          rotate([a[0] + dx * ts[i - 1], a[1] + dy * ts[i - 1]]),
          rotate([a[0] + dx * ts[i], a[1] + dy * ts[i]]),
        ]);
    }
  }
  if (hatch.pattern === 'diagonal' || hatch.pattern === 'cross') {
    for (let y = Math.ceil(minY / spacing) * spacing; y <= maxY; y += spacing)
      clip([minX, y], [maxX, y]);
    if (hatch.pattern === 'cross')
      for (let x = Math.ceil(minX / spacing) * spacing; x <= maxX; x += spacing)
        clip([x, minY], [x, maxY]);
  } else {
    for (let y = Math.floor(minY / spacing) * spacing; y < maxY; y += spacing) {
      for (let x = Math.floor(minX / spacing) * spacing; x < maxX; x += spacing) {
        const path =
          hatch.pattern === 'concrete'
            ? [
                [0.15, 0.15],
                [0.45, 0.25],
                [0.25, 0.55],
                [0.15, 0.15],
              ]
            : hatch.pattern === 'wood'
              ? [
                  [0, 0.3],
                  [0.25, 0.2],
                  [0.5, 0.3],
                  [0.75, 0.4],
                  [1, 0.3],
                ]
              : [
                  [0, 0],
                  [0.5, 1],
                  [1, 0],
                ];
        for (let i = 1; i < path.length; i++)
          clip(
            path[i - 1].map((n, j) => (j ? y : x) + n * spacing),
            path[i].map((n, j) => (j ? y : x) + n * spacing),
          );
        if (hatch.pattern === 'concrete')
          clip([x + 0.7 * spacing, y + 0.7 * spacing], [x + 0.78 * spacing, y + 0.7 * spacing]);
      }
    }
  }
  return result;
}
