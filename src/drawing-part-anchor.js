import * as THREE from 'three';
export function pointOnPart(mesh, point, lower, upper) {
  if (!mesh) return false;
  mesh.updateMatrixWorld();
  const ray = new THREE.Raycaster(
    new THREE.Vector3(point[0], point[1], upper + 1),
    new THREE.Vector3(0, 0, -1),
  );
  return ray
    .intersectObject(mesh, false)
    .some((hit) => hit.point.z >= lower - 1e-6 && hit.point.z <= upper + 1e-6);
}
export function partAnchor(mesh, lower, upper) {
  const g = mesh.geometry;
  g.computeBoundingBox();
  const center = g.boundingBox.getCenter(new THREE.Vector3()),
    p = [center.x, center.y];
  if (pointOnPart(mesh, p, lower, upper)) return p;
  const pos = g.attributes.position,
    index = g.index,
    count = index ? index.count : pos.count;
  for (let i = 0; i < count; i += 3) {
    const ids = [0, 1, 2].map((k) => (index ? index.getX(i + k) : i + k)),
      point = [
        ids.reduce((s, j) => s + pos.getX(j), 0) / 3,
        ids.reduce((s, j) => s + pos.getY(j), 0) / 3,
      ];
    if (pointOnPart(mesh, point, lower, upper)) return point;
  }
  return null;
}
