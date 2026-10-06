import * as THREE from 'three';

export const VIEW_AXES = { X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] };

/** Project global directions into the camera's screen frame, independent of pan and zoom. */
export function viewOrientation(camera) {
  const inverse = camera.quaternion.clone().invert();
  return Object.entries(VIEW_AXES).flatMap(([axis, direction]) =>
    [1, -1].map((sign) => {
      const projected = new THREE.Vector3(...direction)
        .multiplyScalar(sign)
        .applyQuaternion(inverse);
      return { axis, sign, x: projected.x, y: -projected.y, depth: projected.z };
    }),
  );
}
