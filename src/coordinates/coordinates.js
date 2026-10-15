/** Project georeferencing. Local points are millimetres; map coordinates are metres. */
export const defaultCoordinates = () => ({
  crs: '',
  verticalDatum: '',
  activeId: null,
  basePoints: [],
});
const point = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
export function validateCoordinates(value) {
  const fail = () => {
    throw Error('Ogiltiga koordinater eller baspunkter.');
  };
  if (
    !value ||
    !Array.isArray(value.basePoints) ||
    value.basePoints.length > 100 ||
    !['crs', 'verticalDatum'].every((k) => typeof value[k] === 'string' && value[k].length <= 200)
  )
    fail();
  const ids = new Set(),
    names = new Set();
  for (const base of value.basePoints) {
    if (
      !base ||
      typeof base.id !== 'string' ||
      !base.id ||
      base.id.length > 200 ||
      ids.has(base.id) ||
      typeof base.name !== 'string' ||
      !base.name.trim() ||
      base.name.length > 120 ||
      names.has(base.name.trim().toLocaleLowerCase('sv')) ||
      !point(base.local) ||
      base.local.some((v) => Math.abs(v) > 1e12) ||
      !point(base.map) ||
      base.map.some((v) => Math.abs(v) > 1e9) ||
      !Number.isFinite(base.rotation) ||
      Math.abs(base.rotation) > 360
    )
      fail();
    ids.add(base.id);
    names.add(base.name.trim().toLocaleLowerCase('sv'));
  }
  if (value.activeId !== null && !ids.has(value.activeId)) fail();
  return value;
}
export const activeBasePoint = (coordinates) =>
  coordinates?.basePoints.find((p) => p.id === coordinates.activeId) || null;
/** Rotation is counterclockwise from map east to the local X axis, viewed from above. */
export function localToMap(local, base) {
  if (!point(local)) throw Error('Ogiltig koordinat.');
  if (!base) return local.map((v) => v / 1000);
  const a = (base.rotation * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a);
  const [x, y, z] = local.map((v, i) => (v - base.local[i]) / 1000);
  return [base.map[0] + c * x - s * y, base.map[1] + s * x + c * y, base.map[2] + z];
}
export function mapToLocal(map, base) {
  if (!point(map)) throw Error('Ogiltig koordinat.');
  if (!base) return map.map((v) => v * 1000);
  const a = (base.rotation * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a);
  const [x, y, z] = map.map((v, i) => (v - base.map[i]) * 1000);
  return [base.local[0] + c * x + s * y, base.local[1] - s * x + c * y, base.local[2] + z];
}
export function parseCoordinate(text) {
  const value = Number(
    String(text)
      .replace(/[\s\u00a0]/g, '')
      .replace('−', '-')
      .replace(',', '.'),
  );
  if (!String(text).trim() || !Number.isFinite(value))
    throw Error('Ange ett giltigt koordinatvärde.');
  return value;
}
