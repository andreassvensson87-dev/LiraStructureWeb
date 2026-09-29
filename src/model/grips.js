import { isPlate, objectAnchors } from '../model-object.js';
import { plateLocal, platePoint } from '../plate.js';
/** Group only selected, coincident world points; never merge by screen position. */
export function selectionGrips(objects, selectedIds, drawing = false) {
  if (drawing || !selectedIds.size || selectedIds.size >= 5) return [];
  const groups = [];
  for (const object of objects.filter((s) => selectedIds.has(s.id))) {
    objectAnchors(object).forEach((point, index) => {
      const ref = { id: object.id, kind: isPlate(object) ? index : index === 0 ? 'start' : 'end' };
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
export function moveGripPoints(sources, refs, target) {
  return sources.map((source) => {
    const result = structuredClone(source);
    for (const ref of refs.filter((r) => r.id === source.id)) {
      if (typeof ref.kind === 'number') {
        const local = plateLocal(source, target);
        const projected = platePoint(source, local);
        if (Math.hypot(...target.map((v, i) => v - projected[i])) > 0.01)
          throw new Error('Hörnet måste ligga i objektets plan.');
        result.polygon[ref.kind] = local;
      } else result[ref.kind] = [...target];
    }
    return result;
  });
}
