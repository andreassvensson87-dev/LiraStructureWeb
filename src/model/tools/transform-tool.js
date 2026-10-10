import { transformObject } from '../../transform.js';
import { rotateObject } from '../../rotation.js';
import { nextIdentity, designation } from '../../object-identity.js';
import { followFasteners, remapFastenerCopy } from '../../fasteners/relations.js';
import { updateAutomaticJoints } from '../../fasteners/update-joints.js';
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
    return {
      objects: updateAutomaticJoints(
        objects,
        followFasteners(
          objects,
          objects.map((s) => updates.get(s.id) || s),
          new Set(updates.keys()),
        ),
      ),
      ids: batch.map((s) => s.id),
    };
  }
  const batchIds = new Set(batch.map((s) => s.id));
  batch = batch.filter((s) => !s.generatedBy);
  for (const s of objects)
    if (
      ['baseplate', 'stiffener', 'endplate', 'boltedEndplate', 'beamSplice'].includes(s.kind) &&
      !batchIds.has(s.id) &&
      s.references.every((id) => batchIds.has(id))
    )
      batch.push(s);
  const copies = [];
  const ids = new Map(batch.map((s) => [s.id, newId()]));
  for (const s of objects)
    if (s.generatedBy && ids.has(s.generatedBy))
      ids.set(s.id, `${ids.get(s.generatedBy)}${s.id.slice(s.generatedBy.length)}`);
  for (const s of batch) if (s.group && !ids.has(s.group.id)) ids.set(s.group.id, newId());
  for (const s of batch) {
    const object = {
      ...structuredClone(s),
      ...nextIdentity(s, [...objects, ...copies]),
      id: ids.get(s.id),
    };
    if (s.type === 'item') object.item = s.item;
    object.name = designation(object);
    if (object.type === 'gridline') {
      object.gridIdentity = object.id;
      const used = new Set(
        [...objects, ...copies].filter((s) => s.type === 'gridline').map((s) => s.name),
      );
      let index = 1;
      const label = () =>
        object.gridAxis === 'x'
          ? String(index)
          : index <= 26
            ? String.fromCharCode(64 + index)
            : `A${index}`;
      while (used.has(label())) index++;
      object.name = label();
    }
    if (object.type === 'component')
      object.references = object.references.map((id) => ids.get(id) || id);
    copies.push(remapFastenerCopy(object, ids));
  }
  return {
    objects: updateAutomaticJoints(objects, [...objects, ...copies]),
    ids: copies.map((s) => s.id),
  };
}
