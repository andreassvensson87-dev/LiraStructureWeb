import * as THREE from 'three';
export const translateFrame = (source, delta) => ({
  ...source,
  frame: { ...source.frame, origin: source.frame.origin.map((v, i) => v + delta[i]) },
});
export const rotateFrame = (source, { turn, quaternion }) => ({
  ...source,
  frame: {
    ...source.frame,
    origin: turn(source.frame.origin),
    u: new THREE.Vector3(...source.frame.u).applyQuaternion(quaternion).toArray(),
    v: new THREE.Vector3(...source.frame.v).applyQuaternion(quaternion).toArray(),
  },
});
