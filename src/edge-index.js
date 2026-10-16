import * as THREE from 'three';

/** Bounding-volume tree over geometric feature edges, never triangle diagonals. */
export function edgeIndex(array) {
  const ids = Array.from({ length: array.length / 6 }, (_, i) => i);
  const point = (i, end) => new THREE.Vector3().fromArray(array, i * 6 + end * 3);
  const build = (items) => {
    const box = new THREE.Box3();
    for (const i of items) {
      box.expandByPoint(point(i, 0));
      box.expandByPoint(point(i, 1));
    }
    if (items.length <= 24) return { box, items };
    const size = box.getSize(new THREE.Vector3()),
      axis = size.x > size.y ? (size.x > size.z ? 0 : 2) : size.y > size.z ? 1 : 2;
    items.sort(
      (a, b) =>
        array[a * 6 + axis] +
        array[a * 6 + 3 + axis] -
        (array[b * 6 + axis] + array[b * 6 + 3 + axis]),
    );
    const middle = Math.floor(items.length / 2);
    return { box, left: build(items.slice(0, middle)), right: build(items.slice(middle)) };
  };
  const root = build(ids);
  return {
    bounds: root.box,
    query(ray, radius) {
      const result = [],
        box = new THREE.Box3();
      const visit = (node) => {
        if (!ray.intersectsBox(box.copy(node.box).expandByScalar(radius))) return;
        if (node.items) result.push(...node.items);
        else {
          visit(node.left);
          visit(node.right);
        }
      };
      visit(root);
      return result;
    },
  };
}
