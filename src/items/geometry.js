import * as THREE from 'three';
import { meshBounds, pointValid, validateItemDefinition } from './data.js';
const templates = new WeakMap();
function basis(start, end, up = [0, 0, 1]) {
  const x = new THREE.Vector3(...end).sub(new THREE.Vector3(...start)).normalize();
  let z = new THREE.Vector3(...up).addScaledVector(x, -new THREE.Vector3(...up).dot(x));
  if (z.lengthSq() < 1e-8) z = new THREE.Vector3(0, 1, 0).addScaledVector(x, -x.y);
  if (z.lengthSq() < 1e-8) z = new THREE.Vector3(1, 0, 0).addScaledVector(x, -x.x);
  z.normalize();
  const y = z.clone().cross(x).normalize();
  return new THREE.Matrix4().makeBasis(x, y, z);
}
export function placeItem(item, start, target, rotation = 0, up = [0, 0, 1]) {
  if (
    !pointValid(start) ||
    !pointValid(target) ||
    !Number.isFinite(rotation) ||
    Math.hypot(...target.map((v, i) => v - start[i])) < 0.001
  )
    throw Error('Välj två olika punkter för itemets riktning.');
  const local = basis(item.start, item.end),
    world = basis(start, target, up);
  const q = new THREE.Quaternion().setFromRotationMatrix(world.multiply(local.invert()));
  const axis = new THREE.Vector3(...target).sub(new THREE.Vector3(...start)).normalize();
  q.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, (rotation * Math.PI) / 180));
  const end = new THREE.Vector3(...item.end)
    .sub(new THREE.Vector3(...item.start))
    .applyQuaternion(q)
    .add(new THREE.Vector3(...start))
    .toArray();
  return { type: 'item', item, start: [...start], end, quaternion: q.toArray(), rotation };
}
export function itemMatrix(object) {
  const q = new THREE.Quaternion(...object.quaternion);
  const origin = new THREE.Vector3(...object.start).sub(
    new THREE.Vector3(...object.item.start).applyQuaternion(q),
  );
  return new THREE.Matrix4().compose(origin, q, new THREE.Vector3(1, 1, 1));
}
export function itemTemplate(item) {
  let entry = templates.get(item.mesh);
  if (entry) return entry;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(item.mesh.positions, 3));
  geometry.setIndex(item.mesh.indices);
  if (item.mesh.normals)
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(item.mesh.normals, 3));
  else geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const edges = new THREE.EdgesGeometry(geometry, 20);
  entry = { geometry, edges };
  templates.set(item.mesh, entry);
  return entry;
}
export function itemDisplayTemplate(object) {
  return {
    ...itemTemplate(object.item),
    key: `item:${object.item.geometryId}`,
    matrix: itemMatrix(object),
    local: true,
  };
}
export function itemGeometry(object) {
  return itemTemplate(object.item).geometry.clone().applyMatrix4(itemMatrix(object));
}
export function itemCorners(object) {
  if (object.item.snap !== 'box') return [];
  const { min, max } = meshBounds(object.item.mesh),
    points = [],
    matrix = itemMatrix(object);
  for (const x of [min[0], max[0]])
    for (const y of [min[1], max[1]])
      for (const z of [min[2], max[2]])
        points.push(new THREE.Vector3(x, y, z).applyMatrix4(matrix).toArray());
  return points;
}
export function validateItemObject(object) {
  try {
    validateItemDefinition(object.item);
  } catch (error) {
    return error.message;
  }
  if (
    !pointValid(object.start) ||
    !pointValid(object.end) ||
    !Array.isArray(object.quaternion) ||
    object.quaternion.length !== 4 ||
    !object.quaternion.every(Number.isFinite) ||
    Math.abs(Math.hypot(...object.quaternion) - 1) > 1e-6 ||
    !Number.isFinite(object.rotation)
  )
    return 'Ogiltig item-placering.';
  const end = new THREE.Vector3(...object.item.end).applyMatrix4(itemMatrix(object));
  if (end.distanceTo(new THREE.Vector3(...object.end)) > 0.01)
    return 'Itemets storlek får inte ändras vid placering.';
  return '';
}
export function moveItemAnchor(object, kind, target) {
  if (kind === 'start')
    return {
      ...object,
      start: [...target],
      end: object.end.map((v, i) => v + target[i] - object.start[i]),
    };
  if (!pointValid(target)) throw Error('Ogiltig slutpunkt.');
  const axis = new THREE.Vector3(...target).sub(new THREE.Vector3(...object.start));
  if (axis.length() < 0.001) throw Error('Välj två olika punkter för itemets riktning.');
  const previous = new THREE.Vector3(...object.end).sub(new THREE.Vector3(...object.start));
  const q = new THREE.Quaternion()
    .setFromUnitVectors(previous.clone().normalize(), axis.normalize())
    .multiply(new THREE.Quaternion(...object.quaternion));
  return {
    ...object,
    end: axis
      .multiplyScalar(previous.length())
      .add(new THREE.Vector3(...object.start))
      .toArray(),
    quaternion: q.toArray(),
  };
}
export function setItemRoll(object, rotation) {
  if (!Number.isFinite(rotation)) throw Error('Ogiltig rotation.');
  const axis = new THREE.Vector3(...object.end).sub(new THREE.Vector3(...object.start)).normalize();
  const q = new THREE.Quaternion()
    .setFromAxisAngle(axis, ((rotation - object.rotation) * Math.PI) / 180)
    .multiply(new THREE.Quaternion(...object.quaternion));
  return { ...object, rotation, quaternion: q.toArray() };
}
export const itemType = {
  id: 'item',
  label: 'Item',
  prefix: 'IT',
  family: 'item',
  inspector: 'item',
  cut: false,
  geometry: itemGeometry,
  validate: validateItemObject,
  anchors: (s) => [s.start, s.end],
  corners: itemCorners,
  snapSegments: (s) => ({ segments: [[s.start, s.end]], includeEdges: false }),
  partFrame: (s) => {
    const m = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion(...s.quaternion));
    return {
      origin: new THREE.Vector3(...s.start),
      x: new THREE.Vector3().setFromMatrixColumn(m, 0),
      y: new THREE.Vector3().setFromMatrixColumn(m, 1),
      z: new THREE.Vector3().setFromMatrixColumn(m, 2),
    };
  },
  partShape: (s) => ({ type: 'item', geometryId: s.item.geometryId }),
  translate: (s, d) => ({
    ...s,
    start: s.start.map((v, i) => v + d[i]),
    end: s.end.map((v, i) => v + d[i]),
  }),
  rotate: (s, { turn, quaternion }) => ({
    ...s,
    start: turn(s.start),
    end: turn(s.end),
    quaternion: quaternion
      .clone()
      .multiply(new THREE.Quaternion(...s.quaternion))
      .toArray(),
  }),
  moveAnchor: moveItemAnchor,
};
