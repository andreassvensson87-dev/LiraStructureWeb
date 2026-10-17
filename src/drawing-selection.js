import { isPhysical } from './model-object.js';
import { modelAssemblies } from './assembly-series.js';
import { drawingCreationGroups } from './drawing-creation.js';

/** Read-only links through manufacturing identity, including stale source links. */
export function selectionDrawingContext(state, ids) {
  const requested = new Set(ids);
  const selection = new Set(
    state.objects.filter((o) => requested.has(o.id) && isPhysical(o)).map((o) => o.id),
  );
  if (!selection.size) return { selection, groups: [], drawings: [] };
  const assemblies = modelAssemblies(state);
  const relatedAssemblies = assemblies.filter((a) => a.memberIds.some((id) => selection.has(id)));
  const groups = drawingCreationGroups({ ...state, assemblies: relatedAssemblies }, selection);
  const partKeys = new Set(
    [...selection].map((id) => state.parts.assignments[id]?.key).filter(Boolean),
  );
  const drawings = state.drawings
    .filter((record) => {
      if (record.type === 'SP')
        return selection.has(record.sourceId) || partKeys.has(record.partKey);
      if (record.type === 'AS')
        return relatedAssemblies.some((a) =>
          record.assemblyKey
            ? record.assemblyKey === a.typeKey || record.assemblyId === a.id
            : record.assemblyId === a.id,
        );
      return false;
    })
    .map((record) => ({
      record,
      valid: groups.some((g) => g.valid && g.type === record.type && g.drawing?.id === record.id),
    }));
  return { selection, groups, drawings };
}
