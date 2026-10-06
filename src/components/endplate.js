import * as THREE from 'three';
import { contours, profileAnchor, sweepFrame } from '../sweep.js';
import { validatePlate } from '../plate.js';

export const endplateDefaults = {
  endA: 'end',
  sizeMode: 'outstand',
  outstandX: 25,
  outstandY: 25,
  width: 300,
  length: 300,
  thickness: 12,
  gap: 0,
  plateRotation: 0,
};
export function validateEndplate(s) {
  if (
    s.kind !== 'endplate' ||
    !Array.isArray(s.references) ||
    s.references.length !== 1 ||
    typeof s.references[0] !== 'string' ||
    !s.references[0] ||
    s.references[0] === s.id
  )
    return 'Ändplåt behöver en refererad balk eller pelare.';
  if (!['start', 'end'].includes(s.endA) || !['outstand', 'manual'].includes(s.sizeMode))
    return 'Välj objektände och plåtmått.';
  for (const [key, min, max] of [
    ['width', 1, 10000],
    ['length', 1, 10000],
    ['thickness', 1, 1000],
    ['outstandX', 0, 10000],
    ['outstandY', 0, 10000],
    ['gap', 0, 1000],
  ])
    if (!Number.isFinite(s[key]) || s[key] < min || s[key] > max)
      return 'Ange giltiga plåtmått och en spalt på 0–1 000 mm.';
  if (!Number.isFinite(s.plateRotation) || Math.abs(s.plateRotation) > 36000)
    return 'Ange en giltig plåtrotation.';
  return '';
}
export function resolveEndplate(s, model) {
  const error = validateEndplate(s);
  if (error) throw new Error(error);
  const member = model.find((o) => o.id === s.references[0]);
  if (!member || (member.type ?? 'sweep') !== 'sweep' || member.generatedBy)
    throw new Error('Ändplåten saknar en giltig balk eller pelare.');
  for (const other of model.filter((o) => o.type === 'component' && o.id !== s.id)) {
    const index = other.references?.indexOf(member.id);
    if (index == null || index < 0) continue;
    const end = index === 0 ? other.endA : other.endB;
    const affectsEnd =
      ['endplate', 'baseplate'].includes(other.kind) ||
      (other.kind === 'boltedEndplate' && index === 1) ||
      (other.kind === 'fit' && (other.mode === 'miter' || index === 1));
    if (affectsEnd && end === s.endA)
      throw new Error(
        'Objektänden har redan en ändplåt, fotplåt eller Fit. Välj den andra änden eller modifiera den befintliga kopplingen.',
      );
  }
  const frame = sweepFrame(member),
    angle = (s.plateRotation * Math.PI) / 180;
  const u = frame.x.clone().applyAxisAngle(frame.axis, angle),
    v = frame.y.clone().applyAxisAngle(frame.axis, angle);
  const [ax, ay] = profileAnchor(member);
  const points = contours(member)
    .flat()
    .map(([x, y]) => {
      const offset = frame.x
        .clone()
        .multiplyScalar(x - ax)
        .addScaledVector(frame.y, y - ay);
      return [offset.dot(u), offset.dot(v)];
    });
  const minX = Math.min(...points.map((p) => p[0])),
    maxX = Math.max(...points.map((p) => p[0]));
  const minY = Math.min(...points.map((p) => p[1])),
    maxY = Math.max(...points.map((p) => p[1]));
  const profileWidth = maxX - minX,
    profileLength = maxY - minY;
  const plateWidth = s.sizeMode === 'outstand' ? profileWidth + 2 * s.outstandX : s.width;
  const plateLength = s.sizeMode === 'outstand' ? profileLength + 2 * s.outstandY : s.length;
  if (plateWidth < profileWidth - 0.001 || plateLength < profileLength - 0.001)
    throw new Error('Plåten måste rymma profilens tvärsnitt. Öka måtten eller utsticket.');
  const outward = frame.axis.clone().multiplyScalar(s.endA === 'end' ? 1 : -1);
  const origin = new THREE.Vector3(...member[s.endA])
    .addScaledVector(outward, s.gap)
    .addScaledVector(u, (minX + maxX) / 2)
    .addScaledVector(v, (minY + maxY) / 2);
  const result = {
    ...s,
    targets: [member.id],
    cuts: [],
    position: origin.toArray(),
    frame: { origin: origin.toArray(), u: u.toArray(), v: v.toArray() },
    plateWidth,
    plateLength,
    profileWidth,
    profileLength,
  };
  endplateMembers(result, model);
  return JSON.stringify(result) === JSON.stringify(s) ? s : result;
}
export function endplateMembers(s, model) {
  if (!s.id) throw new Error('Ändplåten behöver en identitet.');
  const source = model.find((o) => o.id === s.references[0]);
  const id = `${s.id}:plate`,
    old = model.find((o) => o.id === id && o.generatedBy === s.id);
  // sweepFrame uses x × y = -axis. The plate thickness always extends outwards from its contact face.
  const plate = {
    id,
    type: 'plate',
    name: 'Ändplåt',
    generatedBy: s.id,
    componentRole: 'plate',
    frame: structuredClone(s.frame),
    polygon: [
      [-s.plateWidth / 2, -s.plateLength / 2],
      [s.plateWidth / 2, -s.plateLength / 2],
      [s.plateWidth / 2, s.plateLength / 2],
      [-s.plateWidth / 2, s.plateLength / 2],
    ],
    thickness: s.thickness,
    side: s.endA === 'start' ? 'positive' : 'negative',
    ...(source.material ? { material: structuredClone(source.material) } : {}),
  };
  for (const key of ['name', 'prefix', 'number']) if (old?.[key] != null) plate[key] = old[key];
  const error = validatePlate(plate);
  if (error) throw new Error(error);
  return [old && JSON.stringify(old) === JSON.stringify(plate) ? old : plate];
}
