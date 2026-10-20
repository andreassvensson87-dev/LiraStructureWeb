import { IFCBEAM, IFCCOLUMN, IFCMEMBER, IFCPLATE, IFCBUILDINGELEMENTPROXY } from 'web-ifc';
import { validateSweep } from '../sweep.js';
import { validatePlate } from '../plate.js';
import { nextIdentity } from '../object-identity.js';
import { matchLibraryProfile } from './profile-match.js';
import { extrusionFromMesh } from './conversion-geometry.js';
import { extrusionObjects } from './conversion-object.js';
import { verifyCutConversion } from './conversion-verification.js';
export function convertReferencePart(part, model, kind, profiles, onProfileMatch = () => {}) {
  const result = extrusionFromMesh(part.mesh, kind);
  const { loops, properties } = result;
  let { object, cuts } = extrusionObjects(result, part, model, kind);
  verifyCutConversion(part.mesh, object, cuts);
  if (kind === 'sweep') {
    const evidence = referenceProfileEvidence(part);
    const result = matchLibraryProfile({ ...evidence, geometry: { loops, properties } }, profiles);
    onProfileMatch(result);
    const match = result.suggestion;
    if (result.status === 'verified' && match?.rotation != null) {
      object = conversionProfile(object, match.section, match.rotation);
    }
  }
  const error = kind === 'plate' ? validatePlate(object) : validateSweep(object);
  if (error) throw Error(error);
  return { object, cuts };
}
/** A manual profile choice changes the section, never the recovered axis or source identity. */
export function conversionProfile(object, section, alignment = null) {
  if (object.type !== 'sweep') throw Error('Profilval gäller bara Sweep.');
  const snapshot = structuredClone(section);
  snapshot.anchor = [snapshot.properties.cx, snapshot.properties.cy];
  // Recovered contours already contain the IFC roll in their coordinates.
  // Align the library contour before replacing them; later choices must also
  // compose with the draft's existing rotation rather than resetting it.
  alignment ??= matchLibraryProfile({ geometry: object.section, names: [snapshot.name] }, [
    snapshot,
  ]).suggestion?.rotation;
  const next = {
    ...object,
    rotation: object.rotation + (alignment ?? 0),
    profile: 'custom',
    section: snapshot,
    width: snapshot.properties.bounds.width,
    height: snapshot.properties.bounds.height,
  };
  const error = validateSweep(next);
  if (error) throw Error(error);
  return next;
}
export function referenceProfileEvidence(part) {
  const source = part.mesh.userData.profileEvidence || {};
  return {
    ...source,
    names: [...new Set([...(source.names || []), part.mesh.userData.name].filter(Boolean))],
  };
}
const sourceKey = (s) => s.globalId || `${s.fileName}:${s.expressId}`;
export function planReferenceConversion(model, objects, selectedIds = null, profiles) {
  const groups = new Map(),
    existing = new Set(objects.filter((o) => o.ifcSource).map((o) => sourceKey(o.ifcSource)));
  for (const part of model.parts) {
    const id = part.mesh.userData.ifcId;
    if (selectedIds && !selectedIds.includes(id)) continue;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(part);
  }
  return [...groups].map(([id, parts]) => {
    const part = parts[0],
      data = part.mesh.userData,
      row = { id, name: data.name || `IFC #${id}`, object: null, reason: '', profileMatch: null };
    try {
      if (
        existing.has(
          sourceKey({ fileName: model.fileName, globalId: data.globalId, expressId: id }),
        )
      )
        throw Error('Redan konverterat.');
      if (parts.length !== 1) throw Error('Objekt med flera geometridelar stöds inte ännu.');
      row.profileMatch = matchLibraryProfile(referenceProfileEvidence(part), profiles);
      const kind =
        data.ifcType === IFCPLATE
          ? 'plate'
          : [IFCBEAM, IFCCOLUMN, IFCMEMBER, IFCBUILDINGELEMENTPROXY].includes(data.ifcType)
            ? 'sweep'
            : null;
      if (!kind) throw Error('Den här IFC-objekttypen stöds inte ännu.');
      row.kind = kind;
      const converted = convertReferencePart(part, model, kind, profiles, (result) => {
        row.profileMatch = result;
      });
      Object.assign(row, converted);
    } catch (error) {
      row.reason = error.message;
    }
    return row;
  });
}
export function conversionObjects(rows, objects, createId = () => crypto.randomUUID()) {
  const next = [...objects],
    added = [];
  for (const row of rows) {
    if (!row.object) continue;
    if (next.some((o) => o.ifcSource && sourceKey(o.ifcSource) === sourceKey(row.object.ifcSource)))
      throw Error('Ett valt IFC-objekt är redan konverterat. Öppna förhandsgranskningen igen.');
    const object = structuredClone(row.object);
    object.id = createId();
    object.prefix = object.type === 'plate' ? 'P' : 'B';
    Object.assign(object, nextIdentity(object, next));
    next.push(object);
    added.push(object);
    for (const draft of row.cuts || []) {
      const cut = { ...structuredClone(draft), id: createId(), prefix: 'LC', targets: [object.id] };
      Object.assign(cut, nextIdentity(cut, next));
      next.push(cut);
      added.push(cut);
    }
  }
  return added;
}
