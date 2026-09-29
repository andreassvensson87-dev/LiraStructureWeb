import * as THREE from 'three';
// Draw only edge fragments behind the solid's depth buffer, then visible edges.
export function hiddenEdges(geometry, { dashSize = 20, gapSize = 12, clippingPlanes = [] } = {}) {
  const lines = new THREE.LineSegments(
    geometry,
    new THREE.LineDashedMaterial({
      color: 0x849399,
      dashSize,
      gapSize,
      depthTest: true,
      depthWrite: false,
      depthFunc: THREE.GreaterDepth,
      clippingPlanes,
    }),
  );
  lines.computeLineDistances();
  lines.renderOrder = 1;
  return lines;
}
