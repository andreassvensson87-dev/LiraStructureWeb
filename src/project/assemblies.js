import { validateSeries } from '../numbering/rules.js';
import { isPhysical } from '../model-object.js';
import { partStatus } from '../part-marks.js';
import { objectQuantities } from '../model/object-quantities.js';
import { materialProfile, materialLength } from '../report-material-list.js';
import { applyDrawingPreset } from '../drawing-presets.js';
import * as THREE from 'three';
import { assemblyDrawingMatrix, rebaseAssemblyViews } from '../assembly-frames.js';
import {
  drawingForAssembly,
  assemblyMemberKeys,
  resolveAssemblyDrawing,
} from '../assembly-numbering.js';

export function assemblyMembers(assembly, objects) {
  return assembly.memberIds.map((id) => objects.find((o) => o.id === id && isPhysical(o)));
}
export function assemblyValid(assembly, objects) {
  return (
    !!assembly &&
    assembly.memberIds.includes(assembly.mainId) &&
    assemblyMembers(assembly, objects).every(Boolean)
  );
}
function validatedMembers(state, ids, mainId, ownId) {
  const memberIds = [...new Set(ids)];
  if (memberIds.length < 1) throw Error('Markera minst en fysisk del för en assembly.');
  if (!memberIds.includes(mainId)) throw Error('Huvuddelen måste ingå i assemblyn.');
  if (!memberIds.every((id) => state.objects.some((o) => o.id === id && isPhysical(o))))
    throw Error('Assemblyn får bara innehålla fysiska delar.');
  if (
    (state.assemblies || []).some(
      (a) => a.id !== ownId && a.memberIds.some((id) => memberIds.includes(id)),
    )
  )
    throw Error('En del ingår redan i en annan assembly. Ta bort den från den gruppen först.');
  return memberIds;
}
export function createAssembly(state, ids, mainId, name, uuid = () => crypto.randomUUID()) {
  const memberIds = validatedMembers(state, ids, mainId);
  let i = 1;
  while (
    [...(state.assemblies || []), ...(state.assemblyNumbering?.registry || [])].some(
      (a) => a.mark === `A-${String(i).padStart(3, '0')}`,
    )
  )
    i++;
  const mark = `A-${String(i).padStart(3, '0')}`;
  return {
    id: uuid(),
    mark,
    name:
      String(name || '')
        .trim()
        .slice(0, 200) || mark,
    mainId,
    memberIds,
  };
}
/** Attach selected secondaries to the clicked main part, creating a group when needed. */
export function addToAssembly(state, secondaryIds, mainId) {
  const ids = [...new Set(secondaryIds)];
  if (!ids.length) throw Error('Markera minst en sekundärdel.');
  if (ids.includes(mainId)) throw Error('Välj en huvuddel utanför de markerade sekundärdelarna.');
  const existing = (state.assemblies || []).find((a) => a.memberIds.includes(mainId));
  if (existing) {
    if (existing.mainId !== mainId) throw Error('Klicka på huvuddelen i den befintliga assemblyn.');
    return updateAssembly(state, existing.id, {
      memberIds: [...existing.memberIds, ...ids],
      mainId,
      name: existing.name,
    });
  }
  const assembly = createAssembly(state, [...ids, mainId], mainId);
  return { assemblies: [...(state.assemblies || []), assembly], drawings: state.drawings };
}
export function updateAssembly(state, id, { memberIds, mainId, name, series }) {
  const old = (state.assemblies || []).find((a) => a.id === id);
  if (!old) throw Error('Assemblyn finns inte längre.');
  const next = {
    ...old,
    ...(series ? { series: { ...validateSeries(series) } } : {}),
    memberIds: validatedMembers(state, memberIds, mainId, id),
    mainId,
    name:
      String(name || '')
        .trim()
        .slice(0, 200) || old.mark,
  };
  const membershipChanged =
    old.memberIds.length !== next.memberIds.length ||
    old.memberIds.some((id) => !next.memberIds.includes(id));
  const mainChanged = old.mainId !== next.mainId;
  const seriesChanged = JSON.stringify(old.series) !== JSON.stringify(next.series);
  if (!membershipChanged && !mainChanged && !seriesChanged && old.name === next.name)
    return { assemblies: state.assemblies, drawings: state.drawings };
  const peers = old.typeKey ? state.assemblies.filter((a) => a.typeKey === old.typeKey) : [old];
  const renameType = !membershipChanged && !mainChanged && !seriesChanged && old.name !== next.name;
  const drawings = state.drawings.map((drawing) => {
    if (renameType && old.typeKey && drawing.type === 'AS' && drawing.assemblyKey === old.typeKey)
      return { ...drawing, name: old.mark };
    if (drawing.type !== 'AS' || drawing.assemblyId !== id) return drawing;
    if (peers.length > 1)
      return (
        resolveAssemblyDrawing(drawing, {
          ...state,
          assemblies: state.assemblies.map((a) => (a.id === id ? next : a)),
        }) || drawing
      );
    const edit = structuredClone(drawing);
    if (mainChanged && edit.sheet?.views?.length) {
      const source = state.objects.find((o) => o.id === old.mainId);
      const previous = source
        ? assemblyDrawingMatrix(source)
        : edit.sheet.assemblyModelMatrix
          ? new THREE.Matrix4().fromArray(edit.sheet.assemblyModelMatrix)
          : null;
      if (!previous)
        throw Error(
          'Den tidigare huvuddelen saknas och ritningens riktning kan inte återställas. Ångra borttagningen först.',
        );
      rebaseAssemblyViews(
        edit.sheet,
        previous,
        assemblyDrawingMatrix(state.objects.find((o) => o.id === mainId)),
      );
    }
    edit.sourceId = next.mainId;
    edit.name = next.mark;
    edit.number = next.mark;
    edit.mark = next.mark;
    for (const view of edit.sheet?.views || [])
      if (view.source?.objectId) view.source.objectId = next.mainId;
    if (membershipChanged || mainChanged || seriesChanged) {
      edit.needsReview = true;
      delete edit.reviewed;
    }
    return edit;
  });
  return {
    assemblies: state.assemblies.map((a) =>
      a.id === id
        ? next
        : renameType && peers.some((p) => p.id === a.id)
          ? { ...a, name: next.name }
          : a,
    ),
    drawings,
    ...(renameType && state.assemblyNumbering
      ? {
          assemblyNumbering: {
            ...state.assemblyNumbering,
            registry: state.assemblyNumbering.registry.map((r) =>
              r.key === old.typeKey ? { ...r, name: next.name } : r,
            ),
          },
        }
      : {}),
  };
}
export function assemblySchedule(assembly, state) {
  const rows = new Map();
  for (const object of assemblyMembers(assembly, state.objects).filter(Boolean)) {
    const status = partStatus(object, state.objects, state.parts);
    const key = status.valid ? status.key : object.id;
    if (!rows.has(key)) {
      const metrics = objectQuantities(object, state.objects);
      const plateWidth =
        object.type === 'plate' && object.polygon?.length
          ? Math.min(
              ...[0, 1].map(
                (axis) =>
                  Math.max(...object.polygon.map((p) => p[axis])) -
                  Math.min(...object.polygon.map((p) => p[axis])),
              ),
            )
          : null;
      rows.set(key, {
        key,
        mark: status.valid ? status.mark : 'Ej numrerad',
        name:
          materialProfile(object) +
          (plateWidth == null
            ? ''
            : ` × ${plateWidth.toLocaleString('sv-SE', { maximumFractionDigits: 1, useGrouping: false })}`),
        material: object.material?.name || '—',
        quantity: 0,
        length: materialLength(object),
        unitWeight: metrics.massKg,
        weight: null,
        approximate: metrics.approximate,
      });
    }
    rows.get(key).quantity++;
    const row = rows.get(key);
    row.weight = row.unitWeight == null ? null : row.unitWeight * row.quantity;
  }
  return [...rows.values()].sort((a, b) => a.mark.localeCompare(b.mark, 'sv'));
}
export function createAssemblyDrawing(state, assemblyId, preset, uuid = () => crypto.randomUUID()) {
  const assembly = (state.assemblies || []).find((a) => a.id === assemblyId);
  if (!assemblyValid(assembly, state.objects))
    throw Error('Assemblyn saknar en eller flera delar.');
  if (drawingForAssembly(state, assembly))
    throw Error('Assemblyn har redan en ritning. Öppna den befintliga ritningen.');
  if (state.drawings.some((d) => d.number.toLowerCase() === assembly.mark.toLowerCase()))
    throw Error(`Ritningsnumret ${assembly.mark} används redan av en annan ritning.`);
  if (
    assemblyMembers(assembly, state.objects).some(
      (o) => !partStatus(o, state.objects, state.parts).valid,
    )
  )
    throw Error('Numrera detaljerna innan du skapar assemblyritningen.');
  return applyDrawingPreset(
    {
      id: uuid(),
      type: 'AS',
      number: assembly.mark,
      name: assembly.mark,
      mark: assembly.mark,
      assemblyId,
      ...(assembly.typeKey
        ? {
            assemblyKey: assembly.typeKey,
            assemblyMembers: assemblyMemberKeys(assembly, state.objects, state.parts),
          }
        : {}),
      sourceId: assembly.mainId,
    },
    preset,
  );
}
/** Assembly identity owns its drawing title; also upgrades earlier AS-numbered records. */
export function syncAssemblyDrawingIdentity(state) {
  const assemblies = new Map((state.assemblies || []).map((a) => [a.id, a]));
  let changed = false;
  const drawings = state.drawings.map((drawing) => {
    if (drawing.type === 'SP') {
      const source = state.objects.find((object) => object.id === drawing.sourceId);
      if (!source) return drawing;
      const status = partStatus(source, state.objects, state.parts);
      if (
        status.valid &&
        status.key === drawing.partKey &&
        (drawing.name !== status.mark || drawing.mark !== status.mark)
      ) {
        changed = true;
        return { ...drawing, name: status.mark, mark: status.mark };
      }
      return drawing;
    }
    if (drawing.type === 'AS' && drawing.assemblyKey) {
      const resolved = resolveAssemblyDrawing(drawing, state);
      if (resolved && JSON.stringify(resolved) !== JSON.stringify(drawing)) {
        changed = true;
        return resolved;
      }
      return drawing;
    }
    const assembly = drawing.type === 'AS' && assemblies.get(drawing.assemblyId);
    if (
      !assembly ||
      (drawing.number === assembly.mark &&
        drawing.name === assembly.mark &&
        drawing.mark === assembly.mark)
    )
      return drawing;
    changed = true;
    return { ...drawing, number: assembly.mark, name: assembly.mark, mark: assembly.mark };
  });
  return changed ? drawings : state.drawings;
}
export function removeAssembly(state, id) {
  const assemblies = (state.assemblies || []).filter((a) => a.id !== id);
  return {
    assemblies,
    drawings: state.drawings.flatMap((d) => {
      if (d.type !== 'AS' || d.assemblyId !== id) return [d];
      const resolved = d.assemblyKey && resolveAssemblyDrawing(d, { ...state, assemblies });
      return resolved ? [resolved] : [];
    }),
  };
}
