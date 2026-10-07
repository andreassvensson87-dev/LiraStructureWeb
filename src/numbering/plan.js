import { planDrawingNumbering, applyDrawingNumbering } from '../single-part-drawings.js';
import {
  planAssemblyNumbering,
  applyAssemblyNumbering,
  assemblyMemberKeys,
} from '../assembly-numbering.js';
import { partChangeReasons, assemblyChangeReasons } from './reasons.js';
import { objectType } from '../model/object-types/index.js';
import { isPhysical } from '../model-object.js';

export const defaultNumberingSettings = () => ({
  parts: true,
  assemblies: true,
  series: {
    sweep: { prefix: 'B', start: 1 },
    plate: { prefix: 'P', start: 1 },
    assembly: { prefix: 'A', start: 1 },
  },
});
export function validateNumberingSettings(settings) {
  if (!settings?.parts && !settings?.assemblies) throw Error('Välj detaljer eller assemblies.');
  for (const type of ['sweep', 'plate', 'assembly']) {
    const series = settings.series?.[type];
    if (!series || !/^[\p{L}\p{N}_-]{1,16}$/u.test(series.prefix))
      throw Error('Prefix: 1–16 bokstäver, siffror, _ eller -.');
    if (!Number.isSafeInteger(series.start) || series.start < 1 || series.start > 999999999)
      throw Error('Startnummer: ett heltal mellan 1 och 999999999.');
  }
  return settings;
}
export function numberingStamp(state) {
  return JSON.stringify([
    state.objects,
    state.parts,
    state.assemblies || [],
    state.assemblyNumbering || { registry: [] },
    state.drawings,
  ]);
}
function description(object) {
  const type = objectType(object);
  if (type.id === 'sweep') return `Sweep · ${object.section?.name || object.name || 'Egen profil'}`;
  if (type.id === 'plate') return `Plate · ${object.thickness} mm`;
  return `${type.label} · ${object.name || object.id}`;
}
export function planNumbering(state, settings = defaultNumberingSettings()) {
  validateNumberingSettings(settings);
  const snapshot = structuredClone(state);
  const parts = settings.parts
    ? planDrawingNumbering(snapshot.objects, snapshot.parts, snapshot.drawings, settings.series)
    : null;
  const assemblies = settings.assemblies
    ? planAssemblyNumbering(snapshot, settings.series.assembly)
    : null;
  if (
    assemblies &&
    assemblies.groups.reduce((n, g) => n + g.assemblies.length, 0) !==
      (snapshot.assemblies || []).length
  )
    throw Error('En assembly saknar giltiga delar. Rätta assemblyn före numrering.');
  const rows = new Map();
  const add = (row) => {
    const key = JSON.stringify([
      row.kind,
      row.key,
      row.status,
      row.previous,
      row.proposed,
      row.reasons,
    ]);
    if (!rows.has(key)) rows.set(key, { ...row, ids: [], count: 0 });
    const group = rows.get(key);
    group.ids.push(...row.ids);
    group.count++;
  };
  if (parts)
    for (const object of snapshot.objects.filter(isPhysical)) {
      const previous = snapshot.parts.assignments[object.id],
        next = parts.parts.assignments[object.id];
      add({
        kind: 'part',
        key: next.key,
        status: !previous
          ? 'new'
          : previous.mark !== next.mark || previous.key !== next.key
            ? 'changed'
            : 'unchanged',
        previous: previous?.mark || '—',
        proposed: next.mark,
        reasons: previous
          ? previous.key === next.key
            ? previous.mark === next.mark
              ? []
              : ['Nummer ändrat']
            : partChangeReasons(previous.key, next.key)
          : [],
        label: description(object),
        ids: [object.id],
      });
    }
  if (assemblies)
    for (const group of assemblies.groups)
      for (const assembly of group.assemblies) {
        add({
          kind: 'assembly',
          key: group.key,
          status: !assembly.typeKey
            ? 'new'
            : assembly.mark !== group.mark || assembly.typeKey !== group.key
              ? 'changed'
              : 'unchanged',
          previous: assembly.typeKey ? assembly.mark : '—',
          proposed: group.mark,
          reasons: assembly.typeKey
            ? assembly.typeKey === group.key
              ? assembly.mark === group.mark
                ? []
                : ['Nummer ändrat']
              : assemblyChangeReasons(
                  assembly,
                  group.key,
                  assemblyMemberKeys(assembly, snapshot.objects),
                )
            : [],
          label: `Assembly · ${group.name}`,
          ids: [...assembly.memberIds],
        });
      }
  const conflicts = [
    ...(parts?.groups || []).filter((g) => g.requiresChoice).map((g) => ({ ...g, kind: 'part' })),
    ...(assemblies?.groups || [])
      .filter((g) => g.requiresChoice)
      .map((g) => ({ ...g, kind: 'assembly' })),
  ];
  return {
    stamp: numberingStamp(state),
    state: snapshot,
    parts,
    assemblies,
    rows: [...rows.values()],
    conflicts,
  };
}
export function applyNumbering(
  plan,
  current,
  choices = { part: {}, assembly: {} },
  uuid = () => crypto.randomUUID(),
) {
  if (numberingStamp(current) !== plan.stamp)
    throw Error('Modellen har ändrats. Förhandsgranska numreringen igen.');
  const patch = {
    parts: plan.state.parts,
    drawings: plan.state.drawings,
    assemblies: plan.state.assemblies || [],
    assemblyNumbering: plan.state.assemblyNumbering || { registry: [] },
  };
  if (plan.parts) Object.assign(patch, applyDrawingNumbering(plan.parts, choices.part, uuid));
  if (plan.assemblies)
    Object.assign(
      patch,
      applyAssemblyNumbering(
        { ...plan.assemblies, state: { ...plan.state, ...patch } },
        choices.assembly,
        uuid,
      ),
    );
  return patch;
}
