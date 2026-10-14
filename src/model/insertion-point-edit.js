import { validateObject } from '../model-object.js';
export const radiusPointObject = (object) =>
  object &&
  ['plate', 'polysweep'].includes(object.type) &&
  !object.generatedBy &&
  !object.parametricBlock;
export function pointRadiusBatch(objects, refs, radius) {
  if (!Number.isFinite(radius) || radius < 0 || radius > 1e7)
    throw Error('Ange en radie mellan 0 och 10 000 000 mm.');
  if (!refs.length) throw Error('Markera insättningspunkter.');
  const updates = new Map();
  for (const ref of refs) {
    const source = objects.find((o) => o.id === ref.id),
      count = source?.type === 'plate' ? source.polygon.length : source?.points?.length;
    if (
      !radiusPointObject(source) ||
      !Number.isInteger(ref.kind) ||
      ref.kind < 0 ||
      ref.kind >= count
    )
      throw Error('Välj giltiga insättningspunkter.');
    if (source.type === 'polysweep' && [0, count - 1].includes(ref.kind) && radius !== 0)
      throw Error('Ändpunkter kan inte ha hörnradie.');
    if (!updates.has(source.id))
      updates.set(source.id, {
        ...structuredClone(source),
        radii: source.radii?.slice() || Array(count).fill(0),
      });
    updates.get(source.id).radii[ref.kind] = radius;
  }
  const batch = [...updates.values()];
  for (const object of batch) {
    const error = validateObject(object);
    if (error) throw Error(error);
  }
  return batch;
}
export function editPolysweepPoint(source, index, remove = false) {
  if (
    source.type !== 'polysweep' ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= source.points.length
  )
    throw Error('Välj en giltig insättningspunkt.');
  const result = structuredClone(source);
  result.radii ||= result.points.map(() => 0);
  if (remove) {
    if (result.points.length <= 2) throw Error('Polysweep behöver minst två punkter.');
    result.points.splice(index, 1);
    result.radii.splice(index, 1);
    result.radii[0] = result.radii[result.radii.length - 1] = 0;
  } else {
    if (index === result.points.length - 1) throw Error('Välj ett segment.');
    const a = result.points[index],
      b = result.points[index + 1];
    result.points.splice(
      index + 1,
      0,
      a.map((v, i) => (v + b[i]) / 2),
    );
    result.radii.splice(index + 1, 0, 0);
  }
  const error = validateObject(result);
  if (error) throw Error(error);
  return result;
}
