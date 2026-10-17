import { gripPoint } from './grip-selection.js';
import { isPlate, objectGripPoints } from '../model-object.js';
import { plateLocal, platePoint, plateNormal } from '../plate.js';
import { isFastener } from '../fasteners/object-type.js';
import { objectType } from './object-types/index.js';
import { selectedBlock } from '../blocks/placement.js';
import { blockGripValues } from '../blocks/grip.js';
import { updateModelBlock } from '../blocks/model-adapter.js';
import { cloneTransformSource } from './tools/transform-tool.js';
import { moveFastenerGroupGrips, fastenerGripPlane } from '../fasteners/group-grips.js';
/** Group only selected, coincident world points; never merge by screen position. */
export function selectionGrips(objects, selectedIds, drawing = false) {
  if (drawing || !selectedIds.size) return [];
  const groups = [],
    cells = new Map();
  const cellKey = (p) => p.join(',');
  for (const object of objects.filter(
    (s) => selectedIds.has(s.id) && s.type !== 'component' && !s.generatedBy,
  )) {
    objectGripPoints(object).forEach((point, index) => {
      const ref = {
        id: object.id,
        kind:
          isPlate(object) || object.type === 'polysweep' ? index : index === 0 ? 'start' : 'end',
      };
      const cell = point.map((v) => Math.floor(v / 1e-6));
      let group;
      for (let x = -1; x <= 1 && !group; x++)
        for (let y = -1; y <= 1 && !group; y++)
          for (let z = -1; z <= 1 && !group; z++)
            group = cells
              .get(cellKey([cell[0] + x, cell[1] + y, cell[2] + z]))
              ?.find((g) => Math.hypot(...point.map((v, i) => v - g.point[i])) < 1e-6);
      if (!group) {
        group = {
          point: [...point],
          refs: [],
          label: objectType(object).gripLabels?.(object)?.[index],
        };
        groups.push(group);
        const key = cellKey(cell);
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(group);
      }
      group.refs.push(ref);
    });
  }
  return groups;
}
/** Fully selected physical anchors represent a rigid translation, including a plate's normal direction. */
export function wholeGripObjects(sources, refs) {
  return new Set(
    sources
      .filter(
        (source) =>
          !source.parametricBlock &&
          objectGripPoints(source).every((_, i) =>
            refs.some(
              (ref) =>
                ref.id === source.id &&
                (ref.kind === i || ref.kind === (i === 0 ? 'start' : 'end')),
            ),
          ),
      )
      .map((s) => s.id),
  );
}
export function moveGripPoints(sources, refs, target, base, model = sources) {
  if (sources.some((s) => s.parametricBlock)) {
    const members = selectedBlock(sources, new Set(sources.map((s) => s.id)));
    if (!members.length || refs.length !== 1)
      throw Error('Ändra en blockpunkt i taget eller använd blockets parametrar.');
    const ref = refs[0],
      source = members.find((s) => s.id === ref.id),
      index = typeof ref.kind === 'number' ? ref.kind : ref.kind === 'start' ? 0 : 1;
    return updateModelBlock(
      members,
      blockGripValues(
        source.parametricBlock,
        source.parametricBlock.memberId,
        index,
        base ? gripPoint(source, ref).map((v, i) => v + target[i] - base[i]) : target,
      ),
    );
  }
  const whole = wholeGripObjects(sources, refs);
  const delta = base ? target.map((v, i) => v - base[i]) : null;
  const groupUpdates = moveFastenerGroupGrips(sources, refs, target, base, model);
  return sources.map((source) => {
    if (groupUpdates.has(source.id)) return groupUpdates.get(source.id);
    if (
      delta &&
      (whole.has(source.id) ||
        (source.targets?.length && source.targets.every((id) => whole.has(id))))
    )
      return objectType(source).translate(source, delta);
    let result = cloneTransformSource(source);
    for (const ref of refs.filter((r) => r.id === source.id)) {
      const original = gripPoint(source, ref);
      if (!original) throw Error('Välj en giltig insättningspunkt.');
      const destination = base ? original.map((v, i) => v + target[i] - base[i]) : target;
      if (typeof ref.kind === 'number') {
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
        result = objectType(source).moveAnchor(result, ref.kind, destination);
      else result[ref.kind] = [...destination];
    }
    return result;
  });
}

/** Parallel plate grips constrain the displacement in their shared plane directions. */
export function gripWorkPlane(sources, refs, base) {
  const fastenerPlane = fastenerGripPlane(sources, refs, base);
  if (fastenerPlane) return fastenerPlane;
  const whole = wholeGripObjects(sources, refs);
  const plates = sources.filter(
    (source) =>
      isPlate(source) && !whole.has(source.id) && refs.some((ref) => ref.id === source.id),
  );
  if (!plates.length) return null;
  const normal = plateNormal(plates[0]);
  if (plates.some((plate) => Math.abs(normal.dot(plateNormal(plate))) < 1 - 1e-8)) return null;
  return { origin: [...base], u: [...plates[0].frame.u], v: [...plates[0].frame.v] };
}
