import { itemMatrix } from '../items/geometry.js';
import * as THREE from 'three';
import { objectGeometry, cutsForModel } from '../model-object.js';
import { sweepFrame, contours, profileAnchor } from '../sweep.js';
import { roundProfile } from '../round-profile.js';
import { plateNormal, plateOffsets, plateContour, platePoint } from '../plate.js';

// 0.1 micrometre in model millimetres. CSG can leave sliver faces below the
// geometric kernel tolerance used by IFC readers. Weld and reject those faces
// together, so readers do not collapse their edges into invalid triangles.
const MESH_PRECISION = 0.0001;

/** Final model geometry, never the display approximation or work-area clipping. */
export function exportGeometry(object, objects, mode = 'auto', templates = new WeakMap()) {
  const type = object.type || 'sweep';
  const cuts = cutsForModel(object, objects);
  if (type === 'item' && !cuts.length) {
    let shape = templates.get(object.item);
    if (!shape) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(object.item.mesh.positions, 3),
      );
      geometry.setIndex(object.item.mesh.indices);
      shape = meshShape(geometry);
      templates.set(object.item, shape);
    }
    const matrix = itemMatrix(object);
    return {
      ...shape,
      reuse: object.item,
      origin: new THREE.Vector3(...shape.origin).applyMatrix4(matrix).toArray(),
      x: new THREE.Vector3().setFromMatrixColumn(matrix, 0).toArray(),
      z: new THREE.Vector3().setFromMatrixColumn(matrix, 2).toArray(),
    };
  }
  if (mode !== 'final' && !cuts.length) {
    if (type === 'sweep') {
      const { x, axis, end, start } = sweepFrame(object),
        anchor = profileAnchor(object);
      return {
        kind: 'extrusion',
        origin: end.toArray(),
        x: x.toArray(),
        z: axis.negate().toArray(),
        depth: start.distanceTo(end),
        round: roundProfile(object),
        anchor,
        loops: contours(object).map((loop) => loop.map(([a, b]) => [a - anchor[0], b - anchor[1]])),
      };
    }
    if (type === 'plate')
      return {
        kind: 'extrusion',
        origin: platePoint(object, [0, 0], plateOffsets(object)[0]),
        x: object.frame.u,
        z: plateNormal(object).toArray(),
        depth: object.thickness,
        loops: [plateContour(object)],
      };
  }
  return meshShape(objectGeometry(object, objects, 'exact'));
}
function meshShape(geometry) {
  try {
    const pos = geometry.attributes.position,
      index = geometry.index;
    if (!pos?.count) throw Error('Objektet saknar exporterbar slutgeometri.');
    const origin = [pos.getX(0), pos.getY(0), pos.getZ(0)],
      points = [],
      triangles = [],
      known = new Map(),
      edges = new Map();
    const vertex = (i) => {
      const p = [pos.getX(i) - origin[0], pos.getY(i) - origin[1], pos.getZ(i) - origin[2]].map(
        (v) => Math.round(v / MESH_PRECISION) * MESH_PRECISION,
      );
      if (!p.every(Number.isFinite)) throw Error('Geometrin innehåller ogiltiga koordinater.');
      const key = p.join(',');
      if (known.has(key)) return known.get(key);
      points.push(p);
      known.set(key, points.length);
      return points.length;
    };
    const count = index ? index.count : pos.count;
    if (count % 3) throw Error('Geometrin saknar fullständiga trianglar.');
    let area = 0;
    const a = new THREE.Vector3(),
      b = new THREE.Vector3(),
      c = new THREE.Vector3();
    for (let i = 0; i < count; i += 3) {
      const t = [0, 1, 2].map((k) => vertex(index ? index.getX(i + k) : i + k));
      a.fromArray(points[t[0] - 1]);
      b.fromArray(points[t[1] - 1]).sub(a);
      c.fromArray(points[t[2] - 1]).sub(a);
      const longest = Math.max(b.length(), c.length(), b.distanceTo(c));
      const size = b.cross(c).length();
      if (size <= longest * MESH_PRECISION) continue;
      area += size;
      triangles.push(t);
      for (let k = 0; k < 3; k++) {
        const u = t[k],
          v = t[(k + 1) % 3],
          key = u < v ? `${u},${v}` : `${v},${u}`;
        const edge = edges.get(key) || { count: 0, orientation: 0 };
        edge.count++;
        edge.orientation += u < v ? 1 : -1;
        edges.set(key, edge);
      }
    }
    if (!triangles.length || !Number.isFinite(area)) throw Error('Objektet saknar giltiga ytor.');
    const closed = [...edges.values()].every((e) => e.count === 2 && e.orientation === 0);
    return { kind: 'mesh', origin, x: [1, 0, 0], z: [0, 0, 1], points, triangles, closed };
  } finally {
    geometry.dispose();
  }
}
