// Screen-space geometry supplied by the drawing renderer; no DOM dependency.
export function drawingMarqueeHits(contours, from, to) {
  const rect = [
    Math.min(from[0], to[0]),
    Math.min(from[1], to[1]),
    Math.max(from[0], to[0]),
    Math.max(from[1], to[1]),
  ];
  const inside = (p) => p[0] >= rect[0] && p[0] <= rect[2] && p[1] >= rect[1] && p[1] <= rect[3];
  if (!contours.length) return false;
  if (to[0] >= from[0]) return contours.every(({ points }) => points.every(inside));
  const intersects = (a, b) => {
    let low = 0,
      high = 1;
    for (let axis = 0; axis < 2; axis++) {
      const delta = b[axis] - a[axis];
      if (Math.abs(delta) < 1e-10) {
        if (a[axis] < rect[axis] || a[axis] > rect[axis + 2]) return false;
      } else {
        const bounds = [(rect[axis] - a[axis]) / delta, (rect[axis + 2] - a[axis]) / delta].sort(
          (x, y) => x - y,
        );
        low = Math.max(low, bounds[0]);
        high = Math.min(high, bounds[1]);
        if (low > high) return false;
      }
    }
    return true;
  };
  return contours.some(({ points, closed }) => {
    if (points.some(inside)) return true;
    for (let i = 1; i < points.length; i++) if (intersects(points[i - 1], points[i])) return true;
    if (!closed || points.length < 3) return false;
    if (intersects(points.at(-1), points[0])) return true;
    // A crossing window wholly inside a closed shape still selects that shape.
    let contained = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i],
        b = points[j];
      if (
        a[1] > rect[1] !== b[1] > rect[1] &&
        rect[0] < ((b[0] - a[0]) * (rect[1] - a[1])) / (b[1] - a[1]) + a[0]
      )
        contained = !contained;
    }
    return contained;
  });
}
