import * as THREE from 'three';
export const initialReferencePlacement = () => ({ offset: [0, 0, 0], rotation: 0, scale: 1 });
export function placementQuaternion(p) {
  return p.quaternion
    ? new THREE.Quaternion().fromArray(p.quaternion)
    : new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        THREE.MathUtils.degToRad(p.rotation),
      );
}
export function placementAngles(p) {
  const e = new THREE.Euler().setFromQuaternion(placementQuaternion(p));
  return [e.x, e.y, e.z].map(THREE.MathUtils.radToDeg);
}
export function moveReferencePlacement(p, first, target) {
  return { ...structuredClone(p), offset: p.offset.map((v, i) => v + target[i] - first[i]) };
}
export function rotateReferencePlacement(p, pivot, axis, angle) {
  const direction = new THREE.Vector3().fromArray(axis);
  if (direction.lengthSq() < 1e-12) throw Error('Rotationsaxeln behöver en riktning.');
  const q = new THREE.Quaternion().setFromAxisAngle(
    direction.normalize(),
    THREE.MathUtils.degToRad(angle),
  );
  const origin = new THREE.Vector3().fromArray(pivot);
  const offset = new THREE.Vector3().fromArray(p.offset).sub(origin).applyQuaternion(q).add(origin);
  const quaternion = q.multiply(placementQuaternion(p)).normalize();
  return {
    ...structuredClone(p),
    offset: offset.toArray(),
    quaternion: quaternion.toArray(),
    rotation: THREE.MathUtils.radToDeg(new THREE.Euler().setFromQuaternion(quaternion).z) || 0,
  };
}
export function applyReferencePlacement(model) {
  if (!model.placement) return;
  model.group.position.fromArray(model.placement.offset);
  model.group.quaternion.copy(placementQuaternion(model.placement));
  model.group.scale.setScalar(
    model.placement.scale * (model.format === 'IFC' ? 1 : model.unitFactor),
  );
  model.group.updateMatrixWorld(true);
}
