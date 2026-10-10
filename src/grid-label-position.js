// Clip the actual finite line before placing bubbles, so invisible lines never get labels.
export function visibleGridEndpoints(a, b, width, height, inset = 16) {
  let lo = 0,
    hi = 1;
  const limits = [width, height];
  if (width <= 0 || height <= 0) return null;
  for (let i = 0; i < 2; i++) {
    const d = b[i] - a[i];
    if (Math.abs(d) < 1e-10) {
      if (a[i] < 0 || a[i] > limits[i]) return null;
      continue;
    }
    const t0 = -a[i] / d,
      t1 = (limits[i] - a[i]) / d;
    lo = Math.max(lo, Math.min(t0, t1));
    hi = Math.min(hi, Math.max(t0, t1));
    if (lo > hi) return null;
  }
  return [lo, hi].map((t) =>
    a.map((v, i) => {
      const margin = Math.min(inset, limits[i] / 2);
      return Math.max(margin, Math.min(limits[i] - margin, v + (b[i] - v) * t));
    }),
  );
}

/** The model endpoint touches the inner edge of a camera-facing elliptical bubble. */
export function gridBubbleCenter(endpoint, opposite, radius, height) {
  const dx = endpoint[0] - opposite[0],
    dy = endpoint[1] - opposite[1],
    length = Math.hypot(dx, dy);
  if (length < 1e-9) return [...endpoint];
  const ux = dx / length,
    uy = dy / length;
  const offset = 1 / Math.sqrt((ux / radius) ** 2 + (uy / (height / 2)) ** 2);
  return [endpoint[0] + ux * offset, endpoint[1] + uy * offset];
}
