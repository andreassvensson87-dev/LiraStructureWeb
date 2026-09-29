import { transformObject } from '../../transform.js';
import { rotateObject } from '../../rotation.js';
import { nextIdentity, designation } from '../../object-identity.js';
export function transformCandidates(operation, first, target, draft) {
  return operation
    ? operation.sources.map((s) => transformObject(s, operation.mode, first, target))
    : [{ ...draft, start: first, end: target }];
}
export function rotationCandidates(operation, axis = operation.axis, angle = operation.angle) {
  return operation.sources.map((s) => rotateObject(s, operation.pivot, axis, angle));
}
export function applyObjectBatch(
  objects,
  batch,
  { copy = false, newId = () => crypto.randomUUID() } = {},
) {
  if (!copy) {
    const updates = new Map(batch.map((s) => [s.id, s]));
    return { objects: objects.map((s) => updates.get(s.id) || s), ids: batch.map((s) => s.id) };
  }
  const copies = [];
  for (const s of batch) {
    const object = {
      ...structuredClone(s),
      ...nextIdentity(s, [...objects, ...copies]),
      id: newId(),
    };
    object.name = designation(object);
    copies.push(object);
  }
  return { objects: [...objects, ...copies], ids: copies.map((s) => s.id) };
}
