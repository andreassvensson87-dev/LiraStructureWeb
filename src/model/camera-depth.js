import * as THREE from 'three';

/** Keep depth precision at the displayed model's scale, rather than a fixed 100 km range. */
export function updateCameraDepth(camera, contentBounds, preview = null) {
  const bounds = contentBounds?.clone() || new THREE.Box3();
  if (preview) bounds.expandByObject(preview);
  if (bounds.isEmpty()) return;
  camera.updateMatrixWorld();
  let closest = Infinity,
    furthest = -Infinity;
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z]) {
        const depth = -new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse).z;
        closest = Math.min(closest, depth);
        furthest = Math.max(furthest, depth);
      }
  const margin = Math.max(10, (furthest - closest) * 0.02);
  const near = Math.max(0.01, closest - margin);
  const far = Math.max(near + 100, furthest + margin);
  if (camera.near === near && camera.far === far) return;
  camera.near = near;
  camera.far = far;
  camera.updateProjectionMatrix();
}
