import * as THREE from 'three';
import { axisPlacement, fastenerFrame } from './geometry.js';
import { groupBasis, groupPoint, validateFastenerGroup } from './group-data.js';
import { automaticPlacement } from './placement.js';
import { validateFastener } from './object-type.js';
import { validateFastenerTargets } from './relations.js';

/** Each cell owns its screw and bores; unchanged cells retain their IDs when a grid is edited. */
export function fastenerGroupBatch(
  draft,
  model,
  { fit = true, newId = () => crypto.randomUUID() } = {},
) {
  const group = draft.group;
  validateFastenerGroup(group);
  const previous = new Map(
    model
      .filter((s) => s.group?.id === group.id)
      .map((s) => [`${s.group.row}:${s.group.column}`, s]),
  );
  const basis = groupBasis(group);
  const axis = new THREE.Vector3(...group.direction).sub(new THREE.Vector3(...group.origin));
  const batch = [];
  for (let row = 0; row < group.rows; row++)
    for (let column = 0; column < group.columns; column++) {
      const old = previous.get(`${row}:${column}`);
      const start = groupPoint(group, row, column);
      const direction = new THREE.Vector3(...start).add(axis).toArray();
      let screw = {
        ...draft,
        id: old?.id || (row === 0 && column === 0 && !previous.size ? draft.id : null) || newId(),
        ...(old ? { name: old.name, prefix: old.prefix, number: old.number } : {}),
        ...axisPlacement(draft.spec, start, direction),
        radial: basis.x.toArray(),
        group: { ...structuredClone(group), row, column },
        holes: draft.holes.map((hole) => {
          const existing = old?.holes.find((h) => h.targetId === hole.targetId);
          return { ...structuredClone(hole), id: existing?.id || newId() };
        }),
      };
      delete screw.span;
      delete screw.insertion;
      if (fit) {
        try {
          screw = automaticPlacement(
            screw,
            start,
            direction,
            model,
            draft.groupLimit ?? (draft.insertion?.limited ? draft.insertion.depth : null),
            true,
          );
          const error = validateFastener(screw);
          if (error) throw new Error(error);
          validateFastenerTargets(screw, model);
        } catch (error) {
          throw new Error(`Skruvgrupp · rad ${row + 1}, kolumn ${column + 1}: ${error.message}`);
        }
      }
      batch.push(screw);
    }
  return batch;
}
/** Align a saved grid frame to a newly picked axis while retaining its X direction when possible. */
export function alignFastenerGroup(draft, start, direction) {
  const axis = new THREE.Vector3(...direction).sub(new THREE.Vector3(...start));
  if (axis.length() < 0.001) throw new Error('Välj två olika punkter för skruvaxeln.');
  axis.normalize();
  let u = draft.group?.u && new THREE.Vector3(...draft.group.u);
  if (u) u.addScaledVector(axis, -u.dot(axis));
  if (!u || u.length() < 0.001) {
    u = new THREE.Vector3(1, 0, 0);
    u.addScaledVector(axis, -u.dot(axis));
    if (u.length() < 0.001)
      u = fastenerFrame({
        ...draft,
        ...axisPlacement(draft.spec, start, direction),
        radial: undefined,
      }).x;
  }
  return {
    ...draft,
    group: {
      ...draft.group,
      origin: [...start],
      direction: [...direction],
      u: u.normalize().toArray(),
      row: 0,
      column: 0,
    },
  };
}
/** Replace the whole group atomically, including removed cells. */
export function replaceFastenerGroup(model, batch) {
  const id = batch[0].group.id;
  const updates = new Map(batch.map((s) => [s.id, s]));
  const next = [];
  for (const s of model) {
    if (s.group?.id !== id && !updates.has(s.id)) next.push(s);
    else if (updates.has(s.id)) {
      next.push(updates.get(s.id));
      updates.delete(s.id);
    }
  }
  return [...next, ...updates.values()];
}
