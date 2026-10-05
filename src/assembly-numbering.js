import { partKey, partFrame } from './part-marks.js';
import { assemblyDrawingMatrix, rebaseAssemblyViews } from './assembly-frames.js';
import { clean } from './model/object-types/shape-key.js';
import { isPhysical } from './model-object.js';

/** Manufacturing identity plus placement/orientation in the main part's intrinsic frame. */
export function assemblyMemberKeys(assembly, objects) {
  const byId = new Map(objects.map((o) => [o.id, o]));
  if (
    !assembly ||
    !assembly.memberIds.includes(assembly.mainId) ||
    !assembly.memberIds.every((id) => isPhysical(byId.get(id)))
  )
    return null;
  const matrix = assemblyDrawingMatrix(byId.get(assembly.mainId));
  return assembly.memberIds
    .map((id) => {
      const object = byId.get(id),
        frame = partFrame(object);
      const token = JSON.stringify({
        main: id === assembly.mainId,
        part: partKey(object, objects),
        origin: frame.origin.clone().applyMatrix4(matrix).toArray().map(clean),
        axes: [frame.x, frame.y, frame.z].map((v) =>
          v.clone().transformDirection(matrix).toArray().map(clean),
        ),
      });
      return { id, token };
    })
    .sort((a, b) => a.token.localeCompare(b.token) || a.id.localeCompare(b.id));
}
export function assemblyKey(assembly, objects) {
  const members = assemblyMemberKeys(assembly, objects);
  return members ? JSON.stringify(members.map((m) => m.token)) : null;
}
export function assemblyNumberStatus(assembly, state) {
  const key = assemblyKey(assembly, state.objects);
  return { key, valid: !!key && key === assembly.typeKey };
}
export function drawingForAssembly(state, assembly) {
  return state.drawings.find(
    (d) =>
      d.type === 'AS' &&
      (d.assemblyKey ? d.assemblyKey === assembly.typeKey : d.assemblyId === assembly.id),
  );
}
export function drawingAssemblies(record, state) {
  return (state.assemblies || []).filter((a) =>
    record.assemblyKey
      ? a.typeKey === record.assemblyKey && assemblyKey(a, state.objects) === record.assemblyKey
      : a.id === record.assemblyId && assemblyKey(a, state.objects),
  );
}
/** Carry member-owned annotations between interchangeable instances, or onto a split copy. */
export function assignAssemblyDrawing(record, assembly, state) {
  const copy = structuredClone(record),
    members = assemblyMemberKeys(assembly, state.objects);
  const original = (state.assemblies || []).find((a) => a.id === record.assemblyId);
  const previous =
    record.assemblyMembers || (original && assemblyMemberKeys(original, state.objects)) || [];
  const remaining = [...members],
    ids = new Map();
  for (const member of previous) {
    const index = remaining.findIndex((m) => m.id === member.id);
    if (index >= 0) {
      ids.set(member.id, remaining[index].id);
      remaining.splice(index, 1);
    }
  }
  for (const member of previous) {
    if (ids.has(member.id)) continue;
    const counterpart = assembly.numberedMembers?.find(
      (m) => m.token === member.token && remaining.some((r) => r.id === m.id),
    );
    if (counterpart) {
      ids.set(member.id, counterpart.id);
      remaining.splice(
        remaining.findIndex((m) => m.id === counterpart.id),
        1,
      );
      continue;
    }
    const shapeToken = (token) => {
      const value = JSON.parse(token);
      delete value.main;
      return JSON.stringify(value);
    };
    const index = remaining.findIndex(
      (m) => m.token === member.token || shapeToken(m.token) === shapeToken(member.token),
    );
    if (index >= 0) {
      ids.set(member.id, remaining[index].id);
      remaining.splice(index, 1);
    }
  }
  const oldMain = ids.get(record.sourceId);
  if (
    copy.sheet &&
    record.assemblyKey &&
    record.assemblyKey !== assembly.typeKey &&
    oldMain &&
    oldMain !== assembly.mainId &&
    record.sourceId !== assembly.mainId
  ) {
    rebaseAssemblyViews(
      copy.sheet,
      assemblyDrawingMatrix(state.objects.find((o) => o.id === oldMain)),
      assemblyDrawingMatrix(state.objects.find((o) => o.id === assembly.mainId)),
    );
  }
  copy.assemblyId = assembly.id;
  copy.sourceId = assembly.mainId;
  copy.assemblyKey = assembly.typeKey;
  copy.assemblyMembers = members;
  copy.mark = copy.number = assembly.mark;
  copy.name = assembly.name;
  for (const annotation of copy.annotations || []) {
    if (ids.has(annotation.sourceId)) annotation.sourceId = ids.get(annotation.sourceId);
    for (const ref of annotation.references || [])
      if (ref && ids.has(ref.source)) ref.source = ids.get(ref.source);
  }
  for (const view of copy.sheet?.views || [])
    if (view.source?.objectId) view.source.objectId = assembly.mainId;
  if (copy.sheet)
    copy.sheet.assemblyModelMatrix = assemblyDrawingMatrix(
      state.objects.find((o) => o.id === assembly.mainId),
    ).toArray();
  return copy;
}
export function resolveAssemblyDrawing(record, state) {
  const candidates = drawingAssemblies(record, state);
  const assembly = candidates.find((a) => a.id === record.assemblyId) || candidates[0];
  return assembly ? assignAssemblyDrawing(record, assembly, state) : null;
}
export function planAssemblyNumbering(state) {
  const registry = structuredClone(state.assemblyNumbering?.registry || []),
    groups = new Map();
  const used = new Set([
    ...registry.map((r) => r.mark),
    ...state.drawings.filter((d) => d.type !== 'AS').map((d) => d.number),
  ]);
  for (const assembly of state.assemblies || []) {
    const key = assemblyKey(assembly, state.objects);
    if (!key) {
      used.add(assembly.mark);
      continue;
    }
    if (!groups.has(key)) groups.set(key, { key, assemblies: [], candidates: [] });
    groups.get(key).assemblies.push(assembly);
  }
  // Reserve existing type numbers first; new split types cannot steal a historical number.
  for (const group of groups.values()) {
    let identity = registry.find((r) => r.key === group.key);
    if (!identity) {
      let mark = group.assemblies.find((a) => !used.has(a.mark))?.mark;
      if (!mark) {
        let i = 1;
        while (used.has(`A-${String(i).padStart(3, '0')}`)) i++;
        mark = `A-${String(i).padStart(3, '0')}`;
      }
      identity = { key: group.key, mark, name: group.assemblies[0].name };
      registry.push(identity);
      used.add(mark);
    }
    Object.assign(group, { mark: identity.mark, name: identity.name });
    const origins = new Set(group.assemblies.map((a) => a.typeKey).filter(Boolean));
    const ids = new Set(group.assemblies.map((a) => a.id));
    group.candidates = state.drawings.filter(
      (d) =>
        d.type === 'AS' &&
        (d.assemblyKey === group.key || origins.has(d.assemblyKey) || ids.has(d.assemblyId)),
    );
    group.requiresChoice = group.candidates.length > 1;
  }
  return { state, registry, groups: [...groups.values()] };
}
export function applyAssemblyNumbering(plan, choices = {}, uuid = () => crypto.randomUUID()) {
  for (const group of plan.groups)
    if (group.requiresChoice && !group.candidates.some((d) => d.id === choices[group.key]))
      throw Error(`Välj assemblyritning att behålla för ${group.mark}.`);
  const assemblies = plan.state.assemblies.map((a) => {
    const group = plan.groups.find((g) => g.assemblies.some((member) => member.id === a.id));
    return group ? { ...a, typeKey: group.key, mark: group.mark, name: group.name } : a;
  });
  const involved = new Set(plan.groups.flatMap((g) => g.candidates.map((d) => d.id)));
  const drawings = plan.state.drawings.filter((d) => !involved.has(d.id)),
    used = new Set();
  const groups = [...plan.groups].sort(
    (a, b) =>
      Number(b.candidates.some((d) => d.assemblyKey === b.key)) -
      Number(a.candidates.some((d) => d.assemblyKey === a.key)),
  );
  for (const group of groups) {
    const old = group.candidates.find((d) => d.id === choices[group.key]) || group.candidates[0];
    if (!old) continue;
    const representative =
      group.assemblies.find((a) => a.id === old.assemblyId) || group.assemblies[0];
    const assembly = assemblies.find((a) => a.id === representative.id);
    const copy = assignAssemblyDrawing(old, assembly, plan.state);
    const cloned = used.has(old.id);
    if (cloned) {
      copy.id = uuid();
      copy.clonedFrom = old.number;
    }
    used.add(old.id);
    if (
      cloned ||
      old.assemblyKey !== group.key ||
      group.requiresChoice ||
      old.assemblyId !== assembly.id
    ) {
      copy.needsReview = true;
      delete copy.reviewed;
    }
    drawings.push(copy);
  }
  return {
    assemblies: assemblies.map((a) =>
      plan.groups.some((g) => g.key === a.typeKey && g.assemblies.some((m) => m.id === a.id))
        ? { ...a, numberedMembers: assemblyMemberKeys(a, plan.state.objects) }
        : a,
    ),
    drawings,
    assemblyNumbering: { registry: plan.registry },
  };
}
