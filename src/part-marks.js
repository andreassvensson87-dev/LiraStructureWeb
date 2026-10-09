import { objectSeries, validateSeries, matchingKey, allocateMark } from './numbering/rules.js';
import * as THREE from 'three';
import { objectType } from './model/object-types/index.js';
import { clean } from './model/object-types/shape-key.js';
import { cutsForModel, isPhysical } from './model-object.js';
import { isComponent } from './components/fit.js';
import { defaultPrefix } from './object-identity.js';
export function partFrame(s) {
  return objectType(s).partFrame(s);
}
export function partMatrix(s) {
  const f = partFrame(s);
  return new THREE.Matrix4().makeBasis(f.x, f.y, f.z).setPosition(f.origin).invert();
}
export function partKey(s, objects, options) {
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
  let cuts = cutsForModel(s, objects)
    .flatMap((c) => (isComponent(c) ? c.cuts.filter((cut) => cut.targets.includes(s.id)) : [c]))
    .map((c) =>
      c.type === 'linkedhole'
        ? {
            type: c.type,
            origin: point(c.frame.origin),
            axis: direction(
              new THREE.Vector3(...c.frame.u).cross(new THREE.Vector3(...c.frame.v)).toArray(),
            ),
            diameter: c.diameter,
            depth: c.depth,
            countersink: c.countersink || null,
          }
        : {
            type: c.type,
            origin: point(c.frame.origin),
            u: direction(c.frame.u),
            v: direction(c.frame.v),
            polygon: c.polygon,
            thickness: c.thickness,
            side: c.side,
          },
    )
    .map((c) => JSON.stringify(c, (_, v) => (typeof v === 'number' ? clean(v) : v)))
    .sort();
  if (options?.compareHoles === false)
    cuts = cuts.filter((c) => JSON.parse(c).type !== 'linkedhole');
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
    {
      shape,
      material,
      cuts,
      ...(cuts.length ? { placement: s.placement || null } : {}),
      ...(options
        ? {
            series: validateSeries(objectSeries(s)),
            ...(options.compareNames ? { name: s.name || '' } : {}),
          }
        : {}),
    },
    (_, v) => (typeof v === 'number' ? clean(v) : v),
  );
}
export function numberParts(
  objects,
  state = { registry: [], assignments: {} },
  series = {},
  options,
) {
  options ||= state.options && { ...state.options, renumberAll: false };
  const next = structuredClone(state);
  if (options) {
    next.options = structuredClone(options);
    next.registry = options.renumberAll ? [] : next.registry;
    if (!options.renumberAll) {
      for (const object of objects.filter(isPhysical)) {
        if (object.partSeries) continue;
        const legacy = next.registry.find((r) => r.key === partKey(object, objects));
        if (legacy) legacy.key = partKey(object, objects, options);
      }
    }
    const used = new Set(options.reuseOldNumbers ? [] : next.registry.map((r) => r.mark));
    const physical = objects.filter(isPhysical);
    // Reserve numbers for unchanged active groups before recycling freed numbers.
    for (const object of physical) {
      const key = partKey(object, objects, options);
      const record = next.registry.find((r) => matchingKey(r.key, key, options.tolerance));
      if (record) used.add(record.mark);
    }
    const unchanged = physical
      .filter((object) => {
        const previous = state.assignments[object.id];
        return (
          previous &&
          matchingKey(previous.key, partKey(object, objects, options), options.tolerance)
        );
      })
      .map((object) => state.assignments[object.id]);
    next.assignments = {};
    for (const object of physical) {
      const key = partKey(object, objects, options),
        previous = state.assignments[object.id];
      const force =
        options.renumberAll ||
        (previous
          ? !matchingKey(previous.key, key, options.tolerance) && options.modifiedParts === 'new'
          : options.newParts === 'new');
      let record = next.registry.find(
        (r) =>
          matchingKey(r.key, key, options.tolerance) &&
          (!force ||
            (!options.renumberAll && unchanged.some((a) => a.key === r.key)) ||
            Object.values(next.assignments).some((a) => a.key === r.key)),
      );
      if (!record) {
        record = { key, mark: allocateMark(objectSeries(object), next.registry, used, options) };
        next.registry = next.registry.filter((r) => r.key !== key);
        next.registry.push(record);
      }
      next.assignments[object.id] = { ...record };
    }
    // A recycled number must have a single owner in the registry.
    const active = new Map(Object.values(next.assignments).map((r) => [r.mark, r.key]));
    next.registry = next.registry.filter(
      (r) => !active.has(r.mark) || active.get(r.mark) === r.key,
    );
    return next;
  }
  next.assignments = {};
  for (const s of objects.filter((s) => isPhysical(s))) {
    const key = partKey(s, objects);
    let record = next.registry.find((r) => r.key === key);
    if (!record) {
      const settings = series[objectType(s).id];
      const prefix = settings?.prefix || defaultPrefix(s);
      let number = settings?.start || 1;
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
  return matchingKey(partKey(s, objects, state.options), record.key, state.options?.tolerance)
    ? { ...record, label: record.mark, valid: true }
    : { ...record, label: record.mark + ' · kontroll krävs', valid: false };
}
