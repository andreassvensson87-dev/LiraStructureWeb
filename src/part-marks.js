import * as THREE from 'three';
import { objectType } from './model/object-types/index.js';
import { clean } from './model/object-types/shape-key.js';
import { isCut, isPhysical } from './model-object.js';
import { defaultPrefix } from './object-identity.js';
export function partFrame(s) {
  return objectType(s).partFrame(s);
}
export function partMatrix(s) {
  const f = partFrame(s);
  return new THREE.Matrix4().makeBasis(f.x, f.y, f.z).setPosition(f.origin).invert();
}
export function partKey(s, objects) {
  const f = partFrame(s),
    point = (p) => {
      const v = new THREE.Vector3(...p).sub(f.origin);
      return [v.dot(f.x), v.dot(f.y), v.dot(f.z)].map(clean);
    },
    direction = (p) => {
      const v = new THREE.Vector3(...p);
      return [v.dot(f.x), v.dot(f.y), v.dot(f.z)].map(clean);
    };
  const shape = objectType(s).partShape(s);
  const cuts = objects
    .filter((c) => isCut(c) && c.targets.includes(s.id))
    .map((c) => ({
      type: c.type,
      origin: point(c.frame.origin),
      u: direction(c.frame.u),
      v: direction(c.frame.v),
      polygon: c.polygon,
      thickness: c.thickness,
      side: c.side,
    }))
    .map((c) => JSON.stringify(c, (_, v) => (typeof v === 'number' ? clean(v) : v)))
    .sort();
  // Profile placement matters only relative to machining; a free solid is translation invariant.
  const material = s.material
    ? {
        id: s.material.id,
        revision: s.material.revision,
        name: s.material.name,
        density: s.material.density,
      }
    : null;
  return JSON.stringify(
    { shape, material, cuts, ...(cuts.length ? { placement: s.placement || null } : {}) },
    (_, v) => (typeof v === 'number' ? clean(v) : v),
  );
}
export function numberParts(objects, state = { registry: [], assignments: {} }) {
  const next = structuredClone(state);
  next.assignments = {};
  for (const s of objects.filter((s) => isPhysical(s))) {
    const key = partKey(s, objects);
    let record = next.registry.find((r) => r.key === key);
    if (!record) {
      const prefix = defaultPrefix(s);
      let number = 1;
      while (next.registry.some((r) => r.mark === `${prefix}-${String(number).padStart(3, '0')}`))
        number++;
      record = { key, mark: `${prefix}-${String(number).padStart(3, '0')}` };
      next.registry.push(record);
    }
    next.assignments[s.id] = { ...record };
  }
  return next;
}
export function partStatus(s, objects, state) {
  const record = state.assignments[s.id];
  if (!record) return { label: 'Ej numrerad', valid: false };
  return partKey(s, objects) === record.key
    ? { ...record, label: record.mark, valid: true }
    : { ...record, label: record.mark + ' · kontroll krävs', valid: false };
}
