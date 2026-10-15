import { validateNumberingOwnership } from './validation.js';
import { rekeyAssemblyPartMarks } from './assembly-identity.js';
import { isPhysical } from '../model-object.js';
import { partStatus } from '../part-marks.js';
import { assemblyNumberStatus } from '../assembly-numbering.js';
import { numberingStamp } from './plan.js';

/** Rename one numbered manufacturing type without changing geometry or its series. */
export function planMarkChange(state, { kind, id }, value) {
  if (!['part', 'assembly'].includes(kind)) throw Error('Ogiltig numreringstyp.');
  const mark = String(value).trim();
  if (!/^[\p{L}\p{N}_-]{1,32}$/u.test(mark) || !/\d$/.test(mark))
    throw Error(
      'Ange en mark med högst 32 bokstäver, siffror, _ eller -, avslutad med ett nummer.',
    );
  const part = kind === 'part';
  const source = part
    ? state.objects.find((o) => o.id === id && isPhysical(o))
    : state.assemblies.find((a) => a.id === id);
  const status =
    source &&
    (part ? partStatus(source, state.objects, state.parts) : assemblyNumberStatus(source, state));
  if (!status?.valid) throw Error('Numrera och kontrollera typen innan du byter mark.');
  const key = part ? status.key : source.typeKey;
  const previous = part ? status.mark : source.mark;
  const registry = part ? state.parts.registry : state.assemblyNumbering.registry;
  if (!registry.some((r) => r.key === key && r.mark === previous))
    throw Error('Numreringen är inaktuell. Numrera igen.');
  const owns = (r) => r.key === key;
  if (registry.some((r) => !owns(r) && r.mark.toLowerCase() === mark.toLowerCase()))
    throw Error('Marken är upptagen av en annan typ.');
  const otherRegistry = part ? state.assemblyNumbering.registry : state.parts.registry;
  if (
    otherRegistry.some((r) => r.mark.toLowerCase() === mark.toLowerCase()) ||
    state.drawings.some(
      (d) =>
        d.number.toLowerCase() === mark.toLowerCase() &&
        !(part
          ? d.type === 'SP' && d.partKey === key
          : d.type === 'AS' && (d.assemblyKey === key || d.assemblyId === id)),
    )
  )
    throw Error('Marken används redan av en annan ritning eller numreringstyp.');
  const members = part
    ? state.objects.filter((o) => isPhysical(o) && state.parts.assignments[o.id]?.key === key)
    : state.assemblies.filter((a) => a.typeKey === key);
  if (
    members.some(
      (member) =>
        !(part
          ? partStatus(member, state.objects, state.parts).valid
          : assemblyNumberStatus(member, state).valid),
    )
  )
    throw Error('Typen har ändrats. Numrera igen innan du byter mark.');
  const updateRecord = (r) => (owns(r) ? { ...r, mark, manual: true } : r);
  const patch = {};
  if (part) {
    patch.parts = {
      ...state.parts,
      registry: registry.map(updateRecord),
      assignments: Object.fromEntries(
        Object.entries(state.parts.assignments).map(([objectId, r]) => [objectId, updateRecord(r)]),
      ),
    };
    Object.assign(patch, rekeyAssemblyPartMarks(state, state.parts, patch.parts));
    patch.drawings = (patch.drawings || state.drawings).map((d) =>
      d.type === 'SP' && d.partKey === key ? { ...d, mark, name: mark, number: mark } : d,
    );
  } else {
    patch.assemblyNumbering = { ...state.assemblyNumbering, registry: registry.map(updateRecord) };
    const ids = new Set(members.map((a) => a.id));
    patch.assemblies = state.assemblies.map((a) => (ids.has(a.id) ? { ...a, mark } : a));
    patch.drawings = state.drawings.map((d) =>
      d.type === 'AS' && (d.assemblyKey === key || ids.has(d.assemblyId))
        ? { ...d, mark, name: mark, number: mark }
        : d,
    );
  }
  return {
    stamp: numberingStamp(state),
    patch,
    previous,
    mark,
    count: members.length,
    unchanged: mark === previous,
  };
}

export function applyMarkChange(plan, state) {
  if (numberingStamp(state) !== plan.stamp)
    throw Error('Modellen har ändrats. Öppna Byt mark igen.');
  if (plan.unchanged) return null;
  validateNumberingOwnership({ ...state, ...plan.patch });
  return plan.patch;
}
