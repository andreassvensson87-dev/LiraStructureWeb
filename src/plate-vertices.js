import { validatePlate } from './plate.js';
export function editPlateVertex(source, index, remove = false) {
  if (source.type !== 'plate') throw Error('Välj en Plate.');
  if (!Number.isInteger(index) || index < 0 || index >= source.polygon.length)
    throw Error('Välj ett giltigt hörn.');
  const result = structuredClone(source);
  if (remove) {
    if (result.polygon.length <= 3) throw Error('En Plate måste ha minst tre hörn.');
    result.polygon.splice(index, 1);
  } else {
    const a = result.polygon[index],
      b = result.polygon[(index + 1) % result.polygon.length];
    result.polygon.splice(index + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
  }
  const error = validatePlate(result);
  if (error) throw Error(error);
  return result;
}
