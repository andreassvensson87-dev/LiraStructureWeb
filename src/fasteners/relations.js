import { boreFeature, boreIdentity, transformSpan } from './holes.js';
import * as THREE from 'three';
import { objectType } from '../model/object-types/index.js';
import { isFastener } from './object-type.js';
import { fastenerFrame } from './geometry.js';

const holesCache = new WeakMap();
function derivedHoles(s) {
  let holes = holesCache.get(s);
  if (!holes) {
    const f = fastenerFrame(s);
    holes = s.holes
      .filter((h) => h.kind !== 'none' && h.active !== false)
      .map((h) => ({
        ...structuredClone(h),
        id: boreIdentity(s, h),
        ownerId: s.id,
        type: 'linkedhole',
        targets: [h.targetId],
        frame: {
          origin: f.origin.clone().addScaledVector(f.z, h.offset).toArray(),
          u: f.x.toArray(),
          v: f.y.toArray(),
        },
      }));
    holesCache.set(s, holes);
  }
  return holes;
}
export function holesForPart(part, model) {
  return model
    .filter(isFastener)
    .flatMap((s) => derivedHoles(s).filter((h) => h.targetId === part.id));
}
/** Build once for a bulk operation, preserving the same cached bore identities. */
export function holesByTarget(model) {
  const result = new Map();
  for (const s of model.filter(isFastener))
    for (const hole of derivedHoles(s)) {
      if (!result.has(hole.targetId)) result.set(hole.targetId, []);
      result.get(hole.targetId).push(hole);
    }
  return result;
}
const matrix = (s) => {
  const f = objectType(s).partFrame(s);
  return new THREE.Matrix4().makeBasis(f.x, f.y, f.z).setPosition(f.origin);
};
/** A joint follows its reference part. Explicitly transformed screws win over automatic following. */
export function followFasteners(before, after, explicitlyChanged = new Set()) {
  const previous = new Map(before.map((s) => [s.id, s]));
  const current = new Map(after.map((s) => [s.id, s]));
  return after.map((s) => {
    if (!isFastener(s) || !s.anchorId || explicitlyChanged.has(s.id)) return s;
    const old = previous.get(s.anchorId),
      next = current.get(s.anchorId);
    if (!old || !next || old === next) return s;
    const delta = matrix(next).multiply(matrix(old).invert());
    const turn = (p) => new THREE.Vector3(...p).applyMatrix4(delta).toArray();
    return {
      ...s,
      ...transformSpan(s, turn),
      start: turn(s.start),
      end: turn(s.end),
      radial: fastenerFrame(s).x.transformDirection(delta).toArray(),
    };
  });
}
export function remapFastenerCopy(s, ids) {
  if (!isFastener(s)) return s;
  return {
    ...s,
    anchorId: ids.get(s.anchorId) || s.anchorId,
    holes: s.holes.map((h) =>
      boreFeature({ ...h, id: crypto.randomUUID(), targetId: ids.get(h.targetId) || h.targetId }),
    ),
  };
}
export function removeFastenerRelations(objects, deleted) {
  return objects
    .filter((s) => !deleted.has(s.id))
    .map((s) => {
      if (!isFastener(s)) return s;
      const holes = s.holes.filter((h) => !deleted.has(h.targetId));
      if (holes.length === s.holes.length) return s;
      return {
        ...s,
        holes,
        anchorId: deleted.has(s.anchorId) ? (holes[0]?.targetId ?? null) : s.anchorId,
      };
    });
}
export function validateFastenerTargets(s, model) {
  for (const h of s.holes) {
    const target = model.find((o) => o.id === h.targetId);
    const type = target && objectType(target);
    if (!type || type.cut || type.physical === false || isFastener(target))
      throw new Error('Hål får bara kopplas till befintliga fysiska delar.');
  }
}
