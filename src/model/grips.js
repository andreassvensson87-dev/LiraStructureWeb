import { isPlate, objectAnchors } from '../model-object.js';
import { plateLocal, platePoint, plateNormal } from '../plate.js';
import { isFastener } from '../fasteners/object-type.js';
import { objectType } from './object-types/index.js';
import { selectedBlock } from '../blocks/placement.js';
import { blockGripValues } from '../blocks/grip.js';
import { updateModelBlock } from '../blocks/model-adapter.js';
/** Group only selected, coincident world points; never merge by screen position. */
export function selectionGrips(objects, selectedIds, drawing = false) {
  if (drawing || !selectedIds.size || selectedIds.size >= 5) return [];
  const groups = [];
  for (const object of objects.filter(
    (s) => selectedIds.has(s.id) && s.type !== 'component' && !s.generatedBy,
  )) {
    objectAnchors(object).forEach((point, index) => {
      const ref = {
        id: object.id,
        kind:
          isPlate(object) || object.type === 'polysweep' ? index : index === 0 ? 'start' : 'end',
      };
      let group = groups.find((g) => Math.hypot(...point.map((v, i) => v - g.point[i])) < 1e-6);
      if (!group) {
        group = { point: [...point], refs: [] };
        groups.push(group);
      }
      group.refs.push(ref);
    });
  }
  return groups;
}
export function moveGripPoints(sources, refs, target, base) {
  if (sources.some((s) => s.parametricBlock)) {
    const members = selectedBlock(sources, new Set(sources.map((s) => s.id)));
    if (!members.length || refs.length !== 1)
      throw Error('Ändra en blockpunkt i taget eller använd blockets parametrar.');
    const ref = refs[0],
      source = members.find((s) => s.id === ref.id),
      index = typeof ref.kind === 'number' ? ref.kind : ref.kind === 'start' ? 0 : 1;
    return updateModelBlock(
      members,
      blockGripValues(source.parametricBlock, source.parametricBlock.memberId, index, target),
    );
  }
  return sources.map((source) => {
    let result = structuredClone(source);
    for (const ref of refs.filter((r) => r.id === source.id)) {
      if (typeof ref.kind === 'number') {
        const destination = base
          ? objectAnchors(source)[ref.kind].map((v, i) => v + target[i] - base[i])
          : target;
        if (source.type === 'polysweep') {
          result.points[ref.kind] = [...destination];
          continue;
        }
        const local = plateLocal(source, destination);
        const projected = platePoint(source, local);
        if (Math.hypot(...destination.map((v, i) => v - projected[i])) > 0.01)
          throw new Error('Hörnet måste ligga i objektets plan.');
        result.polygon[ref.kind] = local;
      } else if (isFastener(source) || source.type === 'item')
        result = objectType(source).moveAnchor(result, ref.kind, target);
      else result[ref.kind] = [...target];
    }
    return result;
  });
}

/** Parallel plate grips constrain the displacement in their shared plane directions. */
export function gripWorkPlane(sources, refs, base) {
  const plates = sources.filter(
    (source) => isPlate(source) && refs.some((ref) => ref.id === source.id),
  );
  if (!plates.length) return null;
  const normal = plateNormal(plates[0]);
  if (plates.some((plate) => Math.abs(normal.dot(plateNormal(plate))) < 1 - 1e-8)) return null;
  return { origin: [...base], u: [...plates[0].frame.u], v: [...plates[0].frame.v] };
}
