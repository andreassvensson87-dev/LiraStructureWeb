/** Exact finite-segment intersection, shared by frame and drawing snap. */
export function intersection(a, b, c, d) {
  const rx = b[0] - a[0],
    ry = b[1] - a[1],
    sx = d[0] - c[0],
    sy = d[1] - c[1],
    den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-10) return null;
  const dx = c[0] - a[0],
    dy = c[1] - a[1],
    t = (dx * sy - dy * sx) / den,
    u = (dx * ry - dy * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + t * rx, a[1] + t * ry] : null;
}

// Clip only the search bounds. Exact hits still use the original finite segments.
function localBounds(a, b, raw, tolerance) {
  let first = 0,
    last = 1;
  for (let axis = 0; axis < 2; axis++) {
    const delta = b[axis] - a[axis],
      low = raw[axis] - tolerance,
      high = raw[axis] + tolerance;
    if (delta === 0) {
      if (a[axis] < low || a[axis] > high) return null;
    } else {
      const enter = (low - a[axis]) / delta,
        leave = (high - a[axis]) / delta;
      first = Math.max(first, Math.min(enter, leave));
      last = Math.min(last, Math.max(enter, leave));
      if (first > last) return null;
    }
  }
  const x1 = a[0] + first * (b[0] - a[0]),
    x2 = a[0] + last * (b[0] - a[0]),
    y1 = a[1] + first * (b[1] - a[1]),
    y2 = a[1] + last * (b[1] - a[1]);
  return [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
}

/** Search nearby overlapping bounds, retaining candidate tie order and ortho eligibility. */
export function nearestFrameIntersection(lines, raw, tolerance, orthoBase = null) {
  if (!(tolerance > 0)) return null;
  const nearby = [],
    seen = new Set();
  // Roundoff padding must not narrow the admissible snap area.
  const padding = Math.max(1e-9, ...raw.map(Math.abs)) * Number.EPSILON * 16 + 1e-9;
  for (let index = 0; index < lines.length; index++) {
    const [a, b] = lines[index],
      bounds = localBounds(a, b, raw, tolerance + padding);
    if (!bounds) continue;
    const forward = `${a[0]},${a[1]}:${b[0]},${b[1]}`,
      reverse = `${b[0]},${b[1]}:${a[0]},${a[1]}`;
    if (seen.has(forward) || seen.has(reverse)) continue;
    seen.add(forward);
    nearby.push({ a, b, bounds, index });
  }
  nearby.sort((a, b) => a.bounds[0] - b.bounds[0] || a.index - b.index);
  let closest = null,
    best = tolerance,
    firstIndex = Infinity,
    secondIndex = Infinity;
  for (let i = 0; i < nearby.length; i++) {
    const left = nearby[i];
    for (let j = i + 1; j < nearby.length; j++) {
      const right = nearby[j];
      if (right.bounds[0] > left.bounds[2] + padding) break;
      if (right.bounds[1] > left.bounds[3] + padding || right.bounds[3] < left.bounds[1] - padding)
        continue;
      const first = left.index < right.index ? left : right,
        second = left.index < right.index ? right : left,
        point = intersection(first.a, first.b, second.a, second.b);
      if (
        !point ||
        (orthoBase &&
          Math.min(Math.abs(point[0] - orthoBase[0]), Math.abs(point[1] - orthoBase[1])) > 1e-7)
      )
        continue;
      const distance = Math.hypot(raw[0] - point[0], raw[1] - point[1]);
      if (
        distance < best ||
        (closest &&
          distance === best &&
          (first.index < firstIndex || (first.index === firstIndex && second.index < secondIndex)))
      ) {
        best = distance;
        closest = point;
        firstIndex = first.index;
        secondIndex = second.index;
      }
    }
  }
  return closest;
}
