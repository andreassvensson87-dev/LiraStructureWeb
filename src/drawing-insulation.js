// View-coordinate geometry shared by drawing, grips, snap and PDF export.
export const insulationDefaults = { insulationType: 'soft', thickness: 100, side: 'left' };

export function insulationSettings(item) {
  return {
    insulationType: item.insulationType ?? insulationDefaults.insulationType,
    thickness: item.thickness ?? insulationDefaults.thickness,
    side: item.side ?? insulationDefaults.side,
  };
}

export function insulationFrame(item) {
  const { thickness, side, insulationType } = insulationSettings(item);
  if (!Number.isFinite(thickness) || thickness <= 0)
    throw Error('Ange en positiv isoleringstjocklek i mm.');
  if (!['left', 'right'].includes(side) || !['soft', 'hard'].includes(insulationType))
    throw Error('Välj giltig isoleringstyp och sida.');
  if (
    item.points?.length !== 2 ||
    item.points.some((p) => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite))
  )
    throw Error('Välj isoleringens start- och slutpunkt.');
  const [a, b] = item.points;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (length < 1e-7) throw Error('Välj två olika punkter.');
  const along = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
  const sign = side === 'right' ? -1 : 1;
  const normal = [-along[1] * sign, along[0] * sign];
  const point = (x, y) => a.map((v, i) => v + along[i] * x + normal[i] * y);
  return {
    length,
    thickness,
    along,
    normal,
    point,
    corners: [a, b, point(length, thickness), point(0, thickness)],
  };
}

export function insulationPatternPath(item, project) {
  const { length, thickness, point } = insulationFrame(item);
  // A finite path budget keeps very long/thin bands inexpensive to display/export.
  const count = Math.min(2048, Math.max(1, Math.round(length / thickness)));
  const pitch = length / count;
  const p = (x, y) => project(point(x, y)).join(',');
  if (insulationSettings(item).insulationType === 'hard') {
    let path = `M${p(0, 0)}`;
    for (let i = 0; i < count; i++)
      path += `L${p((i + 0.5) * pitch, thickness)}L${p((i + 1) * pitch, 0)}`;
    return path;
  }
  let path = '';
  for (let i = 0; i < count; i++) {
    const x = i * pitch;
    path += `M${p(x + pitch / 2, 0)}`;
    path += `C${p(x + pitch, 0)} ${p(x + pitch, thickness * 0.35)} ${p(x + pitch / 2, thickness / 2)}`;
    path += `C${p(x, thickness * 0.65)} ${p(x, thickness)} ${p(x + pitch / 2, thickness)}`;
    path += `C${p(x + pitch, thickness)} ${p(x + pitch, thickness * 0.65)} ${p(x + pitch / 2, thickness / 2)}`;
    path += `C${p(x, thickness * 0.35)} ${p(x, 0)} ${p(x + pitch / 2, 0)}`;
  }
  return path;
}
