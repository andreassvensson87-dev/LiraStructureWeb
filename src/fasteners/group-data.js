import * as THREE from 'three';

export const MAX_GROUP_FASTENERS = 100;
const point = (p) =>
  Array.isArray(p) && p.length === 3 && p.every((v) => Number.isFinite(v) && Math.abs(v) <= 1e7);
export function validateFastenerGroup(group) {
  if (!group) return;
  if (
    typeof group.id !== 'string' ||
    !group.id ||
    !Number.isInteger(group.rows) ||
    group.rows < 1 ||
    !Number.isInteger(group.columns) ||
    group.columns < 1 ||
    group.rows * group.columns > MAX_GROUP_FASTENERS ||
    !Number.isInteger(group.row) ||
    group.row < 0 ||
    group.row >= group.rows ||
    !Number.isInteger(group.column) ||
    group.column < 0 ||
    group.column >= group.columns
  )
    throw new Error(
      `Skruvgruppen måste ha 1–${MAX_GROUP_FASTENERS} skruvar och giltiga rader och kolumner.`,
    );
  for (const [count, spacing] of [
    [group.columns, group.spacingX],
    [group.rows, group.spacingY],
  ])
    if (!Number.isFinite(spacing) || spacing < 0 || spacing > 100000 || (count > 1 && spacing <= 0))
      throw new Error('Ange positivt skruvavstånd där gruppen har flera skruvar.');
  if (!Number.isFinite(group.rotation) || Math.abs(group.rotation) > 36000)
    throw new Error('Ange en giltig grupprotation inom ±36 000°.');
  if (![group.origin, group.direction, group.u].every(point))
    throw new Error('Ogiltigt koordinatsystem för skruvgruppen.');
  const axis = new THREE.Vector3(...group.direction).sub(new THREE.Vector3(...group.origin));
  const u = new THREE.Vector3(...group.u);
  if (
    axis.length() < 0.001 ||
    Math.abs(u.length() - 1) > 0.001 ||
    Math.abs(u.dot(axis.normalize())) > 0.001
  )
    throw new Error('Skruvgruppens X-riktning måste vara vinkelrät mot skruvaxeln.');
}
export function groupBasis(group) {
  validateFastenerGroup(group);
  const z = new THREE.Vector3(...group.direction)
    .sub(new THREE.Vector3(...group.origin))
    .normalize();
  const x = new THREE.Vector3(...group.u).applyAxisAngle(z, (group.rotation * Math.PI) / 180);
  return { x, y: new THREE.Vector3().crossVectors(z, x).normalize(), z };
}
export function groupPoint(group, row, column) {
  const { x, y } = groupBasis(group);
  return new THREE.Vector3(...group.origin)
    .addScaledVector(x, column * group.spacingX)
    .addScaledVector(y, row * group.spacingY)
    .toArray();
}
export function transformGroup(source, turn) {
  if (!source.group) return {};
  const group = source.group;
  const origin = turn(group.origin);
  const tip = turn(group.origin.map((v, i) => v + group.u[i]));
  return {
    group: {
      ...group,
      origin,
      direction: turn(group.direction),
      u: new THREE.Vector3(...tip)
        .sub(new THREE.Vector3(...origin))
        .normalize()
        .toArray(),
    },
  };
}
export function groupSelection(objects, ids) {
  const result = new Set(ids);
  const groups = new Set(objects.filter((s) => result.has(s.id) && s.group).map((s) => s.group.id));
  for (const s of objects) if (s.group && groups.has(s.group.id)) result.add(s.id);
  return result;
}
export function selectedFastenerGroup(selected) {
  if (!selected.length || !selected[0].group) return null;
  if (!selected.every((s) => s.type === 'fastener' && s.group?.id === selected[0].group.id))
    return null;
  return selected.find((s) => s.group.row === 0 && s.group.column === 0) || selected[0];
}
/** Reject incomplete or contradictory grids on import instead of silently recreating missing members. */
export function validateFastenerGroups(objects) {
  const groups = new Map();
  for (const s of objects) {
    if (!s.group) continue;
    if (s.type !== 'fastener') throw new Error('Endast skruvar kan ingå i en skruvgrupp.');
    validateFastenerGroup(s.group);
    if (!groups.has(s.group.id)) groups.set(s.group.id, []);
    groups.get(s.group.id).push(s);
  }
  for (const members of groups.values()) {
    const first = members[0].group;
    const signature = (g) =>
      JSON.stringify([
        g.rows,
        g.columns,
        g.spacingX,
        g.spacingY,
        g.rotation,
        g.origin,
        g.direction,
        g.u,
      ]);
    if (
      members.length !== first.rows * first.columns ||
      new Set(members.map((s) => `${s.group.row}:${s.group.column}`)).size !== members.length ||
      members.some((s) => signature(s.group) !== signature(first))
    )
      throw new Error('Skruvgruppen saknar skruvar eller har motstridiga gruppinställningar.');
  }
}
