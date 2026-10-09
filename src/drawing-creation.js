import { batchDrawingGroups, createBatchDrawings } from './single-part-drawings.js';
import { assemblyKey, assemblyNumberStatus, drawingForAssembly } from './assembly-numbering.js';
import { assemblyMembers, createAssemblyDrawing } from './project/assemblies.js';
import { partStatus } from './part-marks.js';

/** One creation row per manufacturing type, with independent SP/AS selection keys. */
export function drawingCreationGroups(state, selection, type = 'all') {
  const parts =
    type === 'AS'
      ? []
      : batchDrawingGroups(state, selection).map((g) => ({
          ...g,
          type: 'SP',
          identityKey: g.key,
          key: `SP:${g.key}`,
          name: g.source.name || '',
          sourceId: g.source.id,
        }));
  if (type === 'SP') return parts;
  const assemblies = new Map();
  for (const assembly of state.assemblies || []) {
    const identityKey = assemblyNumberStatus(assembly, state).valid
        ? assembly.typeKey
        : assemblyKey(assembly, state.objects, state.parts),
      key = `AS:${identityKey || assembly.id}`;
    if (!assemblies.has(key))
      assemblies.set(key, {
        key,
        identityKey,
        type: 'AS',
        mark: assembly.mark,
        name: assembly.name,
        source: assembly,
        sourceId: assembly.mainId,
        objects: [],
        all: [],
        valid: true,
        drawing: null,
        assemblyIds: [],
      });
    const group = assemblies.get(key);
    group.all.push(assembly);
    if (!assembly.memberIds.some((id) => selection.has(id))) continue;
    group.assemblyIds.push(assembly.id);
    group.objects.push(...assemblyMembers(assembly, state.objects).filter(Boolean));
    group.valid &&=
      assemblyNumberStatus(assembly, state).valid &&
      assemblyMembers(assembly, state.objects).every(
        (o) => o && partStatus(o, state.objects, state.parts).valid,
      );
    group.drawing ||= drawingForAssembly(state, assembly);
    if (group.assemblyIds.length === 1) {
      group.source = assembly;
      group.sourceId = assembly.mainId;
      group.mark = assembly.mark;
      group.name = assembly.name;
    }
  }
  return [...parts, ...[...assemblies.values()].filter((g) => g.assemblyIds.length)];
}
export function createSelectedDrawings(
  state,
  selection,
  keys,
  preset,
  template = null,
  uuid = () => crypto.randomUUID(),
) {
  const selected = drawingCreationGroups(state, selection).filter(
    (g) => keys.has(g.key) && g.valid && !g.drawing,
  );
  const drawings = createBatchDrawings(
    state,
    selection,
    new Set(selected.filter((g) => g.type === 'SP').map((g) => g.identityKey)),
    uuid,
    preset,
    template,
  );
  for (const group of selected.filter((g) => g.type === 'AS'))
    drawings.push(createAssemblyDrawing({ ...state, drawings }, group.source.id, preset, uuid));
  return drawings;
}
