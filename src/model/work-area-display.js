import * as THREE from 'three';

/** Renderer-only view crop. Global planes also clip references and native previews. */
export function createWorkAreaDisplay(scene, renderer) {
  let guide = null,
    signature = '';
  return {
    set(bounds, preview = null) {
      const key = JSON.stringify([
        bounds?.min.toArray(),
        bounds?.max.toArray(),
        preview?.min.toArray(),
        preview?.max.toArray(),
      ]);
      if (key === signature) return;
      signature = key;
      // Small numerical margin keeps the boundary wire visible in GPU float arithmetic.
      const margin = 0.05;
      renderer.clippingPlanes = bounds
        ? [
            new THREE.Plane(new THREE.Vector3(1, 0, 0), -bounds.min.x + margin),
            new THREE.Plane(new THREE.Vector3(-1, 0, 0), bounds.max.x + margin),
            new THREE.Plane(new THREE.Vector3(0, 1, 0), -bounds.min.y + margin),
            new THREE.Plane(new THREE.Vector3(0, -1, 0), bounds.max.y + margin),
            new THREE.Plane(new THREE.Vector3(0, 0, 1), -bounds.min.z + margin),
            new THREE.Plane(new THREE.Vector3(0, 0, -1), bounds.max.z + margin),
          ]
        : [];
      if (guide) {
        scene.remove(guide);
        guide.geometry.dispose();
        guide.material.dispose();
        guide = null;
      }
      const box = preview || bounds;
      if (box) {
        const corner = (i) =>
          new THREE.Vector3(
            ...[0, 1, 2].map((axis) => (i & (1 << axis) ? box.max : box.min).getComponent(axis)),
          );
        const vertices = [];
        for (let i = 0; i < 8; i++)
          for (let axis = 0; axis < 3; axis++)
            if (!(i & (1 << axis))) vertices.push(corner(i), corner(i | (1 << axis)));
        guide = new THREE.LineSegments(
          new THREE.BufferGeometry().setFromPoints(vertices),
          new THREE.LineDashedMaterial({
            color: 0x287c65,
            dashSize: 100,
            gapSize: 60,
            transparent: true,
            opacity: 0.75,
            depthTest: false,
          }),
        );
        guide.computeLineDistances();
        guide.renderOrder = 8;
        scene.add(guide);
      }
    },
  };
}
