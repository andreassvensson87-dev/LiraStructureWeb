import * as THREE from 'three';

/** Immutable imported part bounds in reference-local coordinates. Placement stays on the group. */
export function createReferencePartSnapIndex(parts, group) {
  group.updateWorldMatrix(true, true);
  const inverse = group.matrixWorld.clone().invert();
  const entries = parts.flatMap((part, order) => {
    if (!part.edges.length) return [];
    const matrix = inverse.clone().multiply(part.mesh.matrixWorld);
    const box = part.index.bounds?.clone() || new THREE.Box3().setFromArray(part.edges);
    box.applyMatrix4(matrix);
    return box.isEmpty() ? [] : [{ part, order, box }];
  });
  const build = (items) => {
    if (!items.length) return null;
    const box = new THREE.Box3();
    for (const item of items) box.union(item.box);
    if (items.length <= 12) return { box, items };
    const size = box.getSize(new THREE.Vector3());
    const axis = size.x > size.y ? (size.x > size.z ? 'x' : 'z') : size.y > size.z ? 'y' : 'z';
    items.sort((a, b) => a.box.min[axis] + a.box.max[axis] - b.box.min[axis] - b.box.max[axis]);
    const middle = Math.floor(items.length / 2);
    return { box, left: build(items.slice(0, middle)), right: build(items.slice(middle)) };
  };
  const root = build(entries);
  const crop = new THREE.Matrix4(),
    matrix = new THREE.Matrix4(),
    frustum = new THREE.Frustum();
  return {
    parts,
    query({ camera, pointer, width, height }, stats = null) {
      if (!root || !group.visible) return [];
      group.updateWorldMatrix(true, false);
      const sx = width / 32,
        sy = height / 32;
      crop.set(
        sx,
        0,
        0,
        -((pointer[0] * 2) / width - 1) * sx,
        0,
        sy,
        0,
        -(1 - (pointer[1] * 2) / height) * sy,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        1,
      );
      matrix
        .copy(crop)
        .multiply(camera.projectionMatrix)
        .multiply(camera.matrixWorldInverse)
        .multiply(group.matrixWorld);
      frustum.setFromProjectionMatrix(matrix);
      const found = [];
      const visit = (node) => {
        if (!node) return;
        if (stats) stats.nodes = (stats.nodes || 0) + 1;
        if (!frustum.intersectsBox(node.box)) return;
        if (node.items)
          for (const entry of node.items) {
            if (stats) stats.parts = (stats.parts || 0) + 1;
            if (entry.part.mesh.visible && frustum.intersectsBox(entry.box)) found.push(entry);
          }
        else {
          visit(node.left);
          visit(node.right);
        }
      };
      visit(root);
      // Preserve existing equal-distance/depth tie ownership.
      return found.sort((a, b) => a.order - b.order).map((entry) => entry.part);
    },
  };
}
