import { applyDrawingPreset, selectedDrawingPreset } from './drawing-presets.js';
import { isPhysical } from './model-object.js';
import { numberParts, partStatus } from './part-marks.js';
export function nextDrawingNumber(drawings, type = 'SP') {
  let i = 1;
  while (drawings.some((d) => d.number === `${type}-${String(i).padStart(3, '0')}`)) i++;
  return `${type}-${String(i).padStart(3, '0')}`;
}
export function planDrawingNumbering(objects, parts, drawings) {
  const nextParts = numberParts(objects, parts),
    groups = new Map();
  for (const object of objects.filter((o) => isPhysical(o))) {
    const next = nextParts.assignments[object.id];
    if (!groups.has(next.key))
      groups.set(next.key, {
        key: next.key,
        mark: next.mark,
        objects: [],
        origins: new Map(),
        candidates: [],
      });
    const group = groups.get(next.key);
    group.objects.push(object);
    const previous = parts.assignments[object.id];
    if (previous && !group.origins.has(previous.key))
      group.origins.set(previous.key, {
        key: previous.key,
        mark: previous.mark,
        drawings: drawings.filter((d) => d.type === 'SP' && d.partKey === previous.key),
      });
  }
  for (const group of groups.values()) {
    const ids = new Set(group.objects.map((o) => o.id));
    group.candidates = drawings.filter(
      (d) =>
        d.type === 'SP' &&
        (d.partKey === group.key || group.origins.has(d.partKey) || ids.has(d.sourceId)),
    );
    group.origins = [...group.origins.values()];
    group.requiresChoice = group.candidates.length > 1;
    group.merged = group.origins.length > 1 || group.requiresChoice;
  }
  return { parts: nextParts, groups: [...groups.values()], drawings };
}
export function applyDrawingNumbering(plan, choices = {}, uuid = () => crypto.randomUUID()) {
  for (const g of plan.groups)
    if (g.requiresChoice && !g.candidates.some((d) => d.id === choices[g.key]))
      throw Error(`Välj ritning att behålla för ${g.mark}.`);
  const involved = new Set(plan.groups.flatMap((g) => g.candidates.map((d) => d.id))),
    result = plan.drawings.filter((d) => !involved.has(d.id)),
    used = new Set(),
    allocated = [...plan.drawings];
  // Keep the original drawing with unchanged geometry; splits receive independent copies.
  const groups = [...plan.groups].sort(
    (a, b) =>
      Number(b.candidates.some((d) => d.partKey === b.key)) -
      Number(a.candidates.some((d) => d.partKey === a.key)),
  );
  for (const g of groups) {
    const old = g.candidates.find((d) => d.id === choices[g.key]) || g.candidates[0];
    if (!old) continue;
    const clone = used.has(old.id),
      changed = old.partKey !== g.key || clone,
      record = structuredClone(old),
      source = g.objects.find((o) => o.id === old.sourceId) || g.objects[0];
    used.add(old.id);
    if (clone) {
      record.id = uuid();
      record.number = nextDrawingNumber(allocated);
      allocated.push(record);
      record.clonedFrom = old.number;
    }
    record.sourceId = source.id;
    record.partKey = g.key;
    record.mark = g.mark;
    if (record.name === old.mark) record.name = g.mark;
    for (const annotation of record.annotations || [])
      if (annotation.sourceId) annotation.sourceId = source.id;
    if (changed) {
      delete record.reviewed;
      record.needsReview = true;
    }
    result.push(record);
  }
  const keys = result.filter((d) => d.type === 'SP').map((d) => d.partKey);
  if (new Set(keys).size !== keys.length)
    throw Error(
      'Flera Single Part-ritningar finns för samma detaljtyp. Numreringen kan inte slutföras.',
    );
  return { parts: plan.parts, drawings: result };
}
export function batchDrawingGroups(state, selection) {
  const groups = new Map();
  for (const object of state.objects.filter((o) => selection.has(o.id) && isPhysical(o))) {
    const status = partStatus(object, state.objects, state.parts),
      key = status.valid ? status.key : `invalid:${object.id}`;
    if (!groups.has(key)) {
      const all = status.valid
        ? state.objects.filter(
            (o) =>
              isPhysical(o) &&
              state.parts.assignments[o.id]?.key === key &&
              partStatus(o, state.objects, state.parts).valid,
          )
        : [object];
      groups.set(key, {
        key,
        mark: status.valid ? status.mark : status.label,
        valid: status.valid,
        objects: [],
        all,
        source: object,
        drawing: status.valid
          ? state.drawings.find((d) => d.type === 'SP' && d.partKey === key)
          : null,
      });
    }
    groups.get(key).objects.push(object);
  }
  return [...groups.values()];
}
export function createBatchDrawings(
  state,
  selection,
  keys,
  uuid = () => crypto.randomUUID(),
  preset = selectedDrawingPreset(),
  template = null,
) {
  const drawings = [...state.drawings];
  for (const group of batchDrawingGroups(state, selection)) {
    if (
      !keys.has(group.key) ||
      !group.valid ||
      drawings.some((d) => d.type === 'SP' && d.partKey === group.key)
    )
      continue;
    drawings.push(
      applyDrawingPreset(
        {
          id: uuid(),
          type: 'SP',
          ...(template ? { template: structuredClone(template) } : {}),
          number: nextDrawingNumber(drawings),
          name: group.mark,
          sourceId: group.source.id,
          partKey: group.key,
          mark: group.mark,
          levelId: state.levels.active,
          settings: { lower: -1000, cut: 1200, upper: 3000, hiddenLines: false },
        },
        template?.drawingPreset || preset,
      ),
    );
  }
  if (template?.typography)
    for (const record of drawings) {
      if (!state.drawings.some((d) => d.id === record.id))
        record.typography = structuredClone(template.typography);
    }
  return drawings;
}
