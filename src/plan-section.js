// Triangle/plane intersections in model coordinates; suppress triangulation seams on coplanar faces.
export function sectionSegments(geometry, z) {
  const p = geometry.attributes.position,
    index = geometry.index,
    segments = new Map(),
    coplanar = new Map(),
    eps = 1e-5;
  const key = (p) => p.map((v) => Math.round(v / eps)).join(',');
  function add(map, a, b) {
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < eps) return;
    const ka = key(a),
      kb = key(b),
      k = ka < kb ? ka + '|' + kb : kb + '|' + ka;
    const old = map.get(k);
    map.set(k, { points: [a, b], count: (old?.count || 0) + 1 });
  }
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    const tri = [0, 1, 2].map((j) => {
      const n = index ? index.getX(i + j) : i + j;
      return [p.getX(n), p.getY(n), p.getZ(n)];
    });
    if (tri.every((a) => Math.abs(a[2] - z) < eps)) {
      for (let j = 0; j < 3; j++) add(coplanar, tri[j].slice(0, 2), tri[(j + 1) % 3].slice(0, 2));
      continue;
    }
    const hits = new Map();
    for (let j = 0; j < 3; j++) {
      const a = tri[j],
        b = tri[(j + 1) % 3],
        da = a[2] - z,
        db = b[2] - z;
      if (Math.abs(da) < eps) hits.set(key(a.slice(0, 2)), a.slice(0, 2));
      if (da * db < 0 && Math.abs(da) >= eps && Math.abs(db) >= eps) {
        const t = da / (da - db),
          hit = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        hits.set(key(hit), hit);
      }
    }
    if (hits.size === 2) add(segments, ...hits.values());
  }
  for (const [key, item] of coplanar)
    if (item.count === 1 && !segments.has(key)) segments.set(key, item);
  return [...segments.values()].map((s) => s.points);
}
export function planHeights(level, lower, cut, upper) {
  const values = [level, lower, cut, upper];
  if (!values.every(Number.isFinite)) throw Error('Ange giltiga höjder i mm.');
  if (!(lower < upper && cut >= lower && cut <= upper))
    throw Error('Snitthöjden måste ligga mellan undre och övre gränsen.');
  return { lower: level + lower, cut: level + cut, upper: level + upper };
}
