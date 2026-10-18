import * as THREE from 'three';
import { partAxisIntervals } from './placement.js';
import { holesForFastener } from './relations.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const segments = 24;

/** Small closed bore volumes follow the material layers without boolean subtraction. */
export function simplifiedHoleGeometry(
  part,
  model,
  holes,
  geometryContext = null,
  selection = null,
) {
  const points = [];
  const triangle = (a, b, c) => points.push(...a.toArray(), ...b.toArray(), ...c.toArray());
  for (const hole of holes) {
    const origin = new THREE.Vector3(...hole.frame.origin),
      u = new THREE.Vector3(...hole.frame.u),
      v = new THREE.Vector3(...hole.frame.v),
      axis = u.clone().cross(v).normalize();
    const draft = {
      start: origin.toArray(),
      end: origin.clone().add(axis).toArray(),
      radial: u.toArray(),
    };
    let layers;
    try {
      layers = partAxisIntervals(draft, part, model, geometryContext);
    } catch {
      // An axis missing the remaining material has no visible hole marker.
      continue;
    }
    for (const layer of layers) {
      const lo = Math.max(0, layer.offset),
        hi = Math.min(hole.depth, layer.offset + layer.depth);
      if (hi - lo < 0.001) continue;
      const stations = [
        lo,
        ...(hole.countersink && hole.countersink.depth > lo && hole.countersink.depth < hi
          ? [hole.countersink.depth]
          : []),
        hi,
      ];
      const rings = stations.map((offset, j) => {
        const cs = hole.countersink;
        const radius =
          cs && offset < cs.depth
            ? (cs.diameter + ((hole.diameter - cs.diameter) * offset) / cs.depth) / 2
            : hole.diameter / 2;
        const normal = new THREE.Vector3(
          ...(j === 0 && Math.abs(lo - layer.offset) < 0.001
            ? layer.entryNormal
            : j === stations.length - 1 && Math.abs(hi - layer.offset - layer.depth) < 0.001
              ? layer.exitNormal
              : axis.toArray()),
        );
        const center = origin.clone().addScaledVector(axis, offset);
        const ring = Array.from({ length: segments }, (_, i) => {
          const angle = (i * Math.PI * 2) / segments;
          const radial = u
            .clone()
            .multiplyScalar(radius * Math.cos(angle))
            .addScaledVector(v, radius * Math.sin(angle));
          const slope = normal.dot(axis);
          const correction = Math.abs(slope) > 1e-6 ? -normal.dot(radial) / slope : 0;
          return center.clone().add(radial).addScaledVector(axis, correction);
        });
        if (selection)
          for (let i = 0; i < segments; i++)
            selection.rims.push(...ring[i].toArray(), ...ring[(i + 1) % segments].toArray());
        return { center, ring };
      });
      for (let j = 0; j < rings.length - 1; j++)
        for (let i = 0; i < segments; i++) {
          const next = (i + 1) % segments;
          triangle(rings[j].ring[i], rings[j].ring[next], rings[j + 1].ring[next]);
          triangle(rings[j].ring[i], rings[j + 1].ring[next], rings[j + 1].ring[i]);
        }
      for (let i = 0; i < segments; i++) {
        const next = (i + 1) % segments;
        triangle(rings[0].center, rings[0].ring[next], rings[0].ring[i]);
        const last = rings.at(-1);
        triangle(last.center, last.ring[i], last.ring[next]);
        if (selection)
          selection.apertures.push(
            ...rings[0].center.toArray(),
            ...rings[0].ring[next].toArray(),
            ...rings[0].ring[i].toArray(),
            ...last.center.toArray(),
            ...last.ring[i].toArray(),
            ...last.ring[next].toArray(),
          );
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** The same visible material layers provide both window/crossing selection and hole rims. */
export function fastenerHoleDisplayGeometry(
  source,
  model,
  geometryContext = null,
  selection = null,
) {
  const pieces = [];
  for (const hole of holesForFastener(source)) {
    const part = model.find((s) => s.id === hole.targetId);
    if (!part) continue;
    const geometry = simplifiedHoleGeometry(part, model, [hole], geometryContext, selection);
    pieces.push(geometry);
  }
  const geometry = pieces.length
    ? mergeGeometries(pieces)
    : new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([], 3));
  pieces.forEach((piece) => piece.dispose());
  return geometry;
}

/** Hole rims remain owned by the group when its bolt is disabled. Exact solids stay untouched. */
export function fastenerDisplayEdges(source, model, edges, matrix, geometryContext = null) {
  if (source.assembly?.bolt !== false) return edges;
  const selection = { rims: [], apertures: [] };
  fastenerHoleDisplayGeometry(source, model, geometryContext, selection).dispose();
  if (!selection.rims.length) return edges;
  const holes = new THREE.BufferGeometry().setAttribute(
    'position',
    new THREE.Float32BufferAttribute(selection.rims, 3),
  );
  const apertures = new THREE.Float32BufferAttribute(selection.apertures, 3);
  if (matrix) {
    const inverse = matrix.clone().invert();
    holes.applyMatrix4(inverse);
    apertures.applyMatrix4(inverse);
  }
  const combined = mergeGeometries([edges, holes]);
  combined.userData.holeApertures = apertures;
  edges.dispose();
  holes.dispose();
  return combined;
}

export function holeDisplayMesh(
  part,
  model,
  holes,
  transparentView,
  ghost,
  geometryContext = null,
) {
  if (!holes.length) return null;
  const geometry = simplifiedHoleGeometry(part, model, holes, geometryContext);
  if (!geometry.attributes.position.count) {
    geometry.dispose();
    return null;
  }
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: 0x617783,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      transparent: transparentView || ghost,
      opacity: ghost ? 0.45 : transparentView ? 0.65 : 1,
      depthWrite: !transparentView && !ghost,
    }),
  );
  mesh.userData.holeMarker = true;
  mesh.userData.detailDiameter = Math.max(
    ...holes.map((hole) => hole.countersink?.diameter || hole.diameter),
  );
  mesh.raycast = () => {};
  return mesh;
}
