/** View-space bounds hierarchy. Each face occurs once; no per-edge candidate Set. */
export function drawingOcclusionIndex(triangles) {
  const items = triangles.slice();
  const build = (start, end) => {
    const box = [Infinity, Infinity, -Infinity, -Infinity];
    let maxZ = -Infinity;
    for (let i = start; i < end; i++) {
      const t = items[i];
      box[0] = Math.min(box[0], t.box[0]);
      box[1] = Math.min(box[1], t.box[1]);
      box[2] = Math.max(box[2], t.box[2]);
      box[3] = Math.max(box[3], t.box[3]);
      maxZ = Math.max(maxZ, t.points[0][2], t.points[1][2], t.points[2][2]);
    }
    const node = { box, maxZ, start, end };
    if (end - start <= 16) return node;
    const axis = box[2] - box[0] >= box[3] - box[1] ? 0 : 1;
    // Partition at the median without sorting every subtree.
    const middle = (start + end) >>> 1;
    const center = (t) => t.box[axis] + t.box[axis + 2];
    let lo = start,
      hi = end - 1;
    while (lo < hi) {
      const pivot = center(items[(lo + hi) >>> 1]);
      let left = lo,
        right = hi;
      while (left <= right) {
        while (center(items[left]) < pivot) left++;
        while (center(items[right]) > pivot) right--;
        if (left <= right) {
          [items[left], items[right]] = [items[right], items[left]];
          left++;
          right--;
        }
      }
      if (middle <= right) hi = right;
      else if (middle >= left) lo = left;
      else break;
    }
    node.left = build(start, middle);
    node.right = build(middle, end);
    return node;
  };
  const root = items.length ? build(0, items.length) : null;
  return (box, minZ, action) => {
    const overlaps = (b) => box[0] <= b[2] && box[2] >= b[0] && box[1] <= b[3] && box[3] >= b[1];
    const visit = (node) => {
      // Conservative depth rejection; exact 0.001 mm test remains in the projector.
      if (!node || node.maxZ < minZ - 0.001 || !overlaps(node.box)) return;
      if (node.left) {
        visit(node.left);
        visit(node.right);
      } else
        for (let i = node.start; i < node.end; i++) if (overlaps(items[i].box)) action(items[i]);
    };
    visit(root);
  };
}
