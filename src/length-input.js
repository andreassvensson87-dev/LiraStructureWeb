export function endpointAtLength(start, direction, text) {
  const value = text.trim().replace(',', '.');
  const length = /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : NaN;
  if (!Number.isFinite(length) || length < 1) throw new Error('Ange en längd på minst 1 mm.');
  const magnitude = direction ? Math.hypot(...direction) : 0;
  if (!Number.isFinite(magnitude) || magnitude < 1e-8)
    throw new Error('Peka ut en riktning eller lås X, Y eller Z först.');
  const end = start.map((v, i) => v + (direction[i] / magnitude) * length);
  if (end.some((v) => !Number.isFinite(v) || Math.abs(v) > 1e7))
    throw new Error('Slutpunkten måste ligga inom ±10 000 000 mm.');
  return end;
}
