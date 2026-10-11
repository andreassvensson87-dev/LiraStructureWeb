import * as THREE from 'three';
import { sectionSegments } from '../plan-section.js';
import { clipSectionSegment } from '../section-extents.js';

export const drawingReferenceOptions = (settings, id) => ({
  visible: settings?.ifcReferences?.[id]?.visible === true,
  hiddenLines: settings?.ifcReferences?.[id]?.hiddenLines === true,
  snap: settings?.ifcReferences?.[id]?.snap !== false,
});

/** Copies only parts intersecting the view. Never changes the imported meshes. */
export function drawingReferenceGeometry(models, settings, { matrix, heights, crop }) {
  const result = [];
  for (const model of models) {
    const options = drawingReferenceOptions(settings, model.id);
    if (model.format !== 'IFC' || !options.visible) continue;
    for (const part of model.parts) {
      part.mesh.updateWorldMatrix(true, false);
      const transform = matrix.clone().multiply(part.mesh.matrixWorld);
      const source = part.mesh.geometry;
      if (!source.boundingBox) source.computeBoundingBox();
      const bounds = source.boundingBox.clone().applyMatrix4(transform);
      if (
        bounds.max.z < heights.lower ||
        bounds.min.z > heights.upper ||
        (crop &&
          (bounds.max.x < crop[0] ||
            bounds.min.x > crop[2] ||
            bounds.max.y < crop[1] ||
            bounds.min.y > crop[3]))
      )
        continue;
      // MeshBasicMaterial/projection need positions and topology, not imported normals/UVs.
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', source.attributes.position.clone());
      if (source.index) geometry.setIndex(source.index.clone());
      geometry.applyMatrix4(transform);
      const edges = new THREE.BufferGeometry();
      edges.setAttribute('position', new THREE.BufferAttribute(part.edges.slice(), 3));
      edges.applyMatrix4(transform);
      result.push({
        referenceId: model.id,
        geometry,
        edges,
        cut: sectionSegments(geometry, heights.cut),
        options,
        bounds,
      });
    }
  }
  return result;
}

/** Section framing includes IFC edges and cuts before applying the paper crop. */
export function drawingReferenceSectionBounds(models, settings, { matrix, depth, planes }) {
  const bounds = new THREE.Box2();
  const parts = drawingReferenceGeometry(models, settings, {
    matrix,
    heights: { lower: -depth, cut: 0, upper: 0 },
  });
  const include = (a, b) => {
    const clipped = clipSectionSegment(a, b, planes);
    if (clipped)
      for (const point of clipped) bounds.expandByPoint(new THREE.Vector2(point[0], point[1]));
  };
  try {
    for (const part of parts) {
      const p = part.edges.attributes.position;
      for (let i = 0; i + 1 < p.count; i += 2)
        include([p.getX(i), p.getY(i), p.getZ(i)], [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)]);
      for (const [a, b] of part.cut) include([...a, 0], [...b, 0]);
    }
    return bounds;
  } finally {
    for (const part of parts) {
      part.geometry.dispose();
      part.edges.dispose();
    }
  }
}

/** A view-space index feeding the existing drawing snap engine. */
export function drawingReferenceSnapIndex(sets) {
  const entries = sets
    .filter((set) => set.referenceId && set.referenceSnap)
    .flatMap((set) => set.visible.map(([a, b]) => [a.slice(0, 2), b.slice(0, 2)]));
  const build = (items) => {
    if (!items.length) return null;
    const bounds = [Infinity, Infinity, -Infinity, -Infinity];
    for (const points of items)
      for (const p of points) {
        bounds[0] = Math.min(bounds[0], p[0]);
        bounds[1] = Math.min(bounds[1], p[1]);
        bounds[2] = Math.max(bounds[2], p[0]);
        bounds[3] = Math.max(bounds[3], p[1]);
      }
    if (items.length <= 24) return { bounds, items };
    const axis = bounds[2] - bounds[0] > bounds[3] - bounds[1] ? 0 : 1;
    items.sort((a, b) => a[0][axis] + a[1][axis] - b[0][axis] - b[1][axis]);
    const mid = Math.floor(items.length / 2);
    return { bounds, left: build(items.slice(0, mid)), right: build(items.slice(mid)) };
  };
  const root = build(entries);
  return (point, tolerance) => {
    const found = [];
    const visit = (node) => {
      if (!node) return;
      const [x, y] = point,
        b = node.bounds;
      if (
        x + tolerance < b[0] ||
        x - tolerance > b[2] ||
        y + tolerance < b[1] ||
        y - tolerance > b[3]
      )
        return;
      if (node.items)
        found.push(
          ...node.items.filter(
            ([a, b]) =>
              Math.min(a[0], b[0]) <= x + tolerance &&
              Math.max(a[0], b[0]) >= x - tolerance &&
              Math.min(a[1], b[1]) <= y + tolerance &&
              Math.max(a[1], b[1]) >= y - tolerance,
          ),
        );
      else {
        visit(node.left);
        visit(node.right);
      }
    };
    visit(root);
    return found;
  };
}
