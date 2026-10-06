import * as THREE from 'three';
import { fastenerAccessories } from './accessories.js';
import { geometryEdges } from './edges.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function fastenerFrame(s) {
  const origin = new THREE.Vector3(...s.start);
  const z = new THREE.Vector3(...s.end).sub(origin).normalize();
  const x = s.radial
    ? new THREE.Vector3(...s.radial)
        .addScaledVector(z, -new THREE.Vector3(...s.radial).dot(z))
        .normalize()
    : new THREE.Vector3(Math.abs(z.z) < 0.9 ? 0 : 1, 0, Math.abs(z.z) < 0.9 ? 1 : 0)
        .cross(z)
        .normalize();
  const y = z.clone().cross(x);
  return { origin, x, y, z };
}
export function axisPoint(s, offset) {
  return fastenerFrame(s).origin.addScaledVector(fastenerFrame(s).z, offset).toArray();
}
export function axisPlacement(spec, start, directionPoint) {
  const direction = new THREE.Vector3(...directionPoint).sub(new THREE.Vector3(...start));
  if (direction.length() < 1e-6) throw new Error('Välj två olika punkter för skruvens riktning.');
  return {
    start: [...start],
    end: direction
      .normalize()
      .multiplyScalar(spec.length)
      .add(new THREE.Vector3(...start))
      .toArray(),
  };
}
function cylinder(top, bottom, length, offset, segments = 48) {
  const g = new THREE.CylinderGeometry(top, bottom, length, segments);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, offset + length / 2);
  return g.toNonIndexed();
}
function localFastenerGeometry(s) {
  const spec = s.spec,
    r = spec.diameter / 2;
  const pieces = [cylinder(r, r, spec.length, 0)];
  if (spec.head?.kind === 'hex')
    pieces.push(
      cylinder(
        spec.head.diameter / Math.sqrt(3),
        spec.head.diameter / Math.sqrt(3),
        spec.head.height,
        -spec.head.height,
        6,
      ),
    );
  else if (spec.head)
    pieces.push(
      cylinder(
        spec.head.diameter / 2,
        spec.head.kind === 'countersunk' ? r : spec.head.diameter / 2,
        spec.head.height,
        -spec.head.height,
      ),
    );
  for (const accessory of fastenerAccessories(s).filter((item) => item.kind === 'nut')) {
    const radius = spec.nut.acrossFlats / Math.sqrt(3);
    const shape = new THREE.Shape(
      Array.from(
        { length: 6 },
        (_, i) =>
          new THREE.Vector2(
            radius * Math.cos((i * Math.PI) / 3),
            radius * Math.sin((i * Math.PI) / 3),
          ),
      ),
    );
    const bore = new THREE.Path();
    bore.absarc(0, 0, r, 0, Math.PI * 2, true);
    shape.holes.push(bore);
    const nut = new THREE.ExtrudeGeometry(shape, {
      depth: spec.nut.thickness,
      bevelEnabled: false,
      curveSegments: 24,
    });
    nut.translate(0, 0, accessory.offset);
    pieces.push(nut);
  }
  for (const { offset } of fastenerAccessories(s).filter((item) => item.kind === 'washer')) {
    const washer = spec.washer;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, washer.outerDiameter / 2, 0, Math.PI * 2, false);
    const bore = new THREE.Path();
    bore.absarc(0, 0, washer.innerDiameter / 2, 0, Math.PI * 2, true);
    shape.holes.push(bore);
    const ring = new THREE.ExtrudeGeometry(shape, {
      depth: washer.thickness,
      bevelEnabled: false,
      curveSegments: 24,
    });
    ring.translate(0, 0, offset);
    pieces.push(ring);
  }
  const geometry = mergeGeometries(pieces);
  pieces.forEach((g) => g.dispose());
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
// Bounded templates contain modelling dimensions only; placement and hole edits
// never change the screw shape. Render wrappers own their GPU attributes.
const templates = new Map();
export function fastenerDisplayTemplate(s) {
  const key = JSON.stringify([s.spec, fastenerAccessories(s)]);
  let template = templates.get(key);
  if (!template) {
    const geometry = localFastenerGeometry(s);
    template = { geometry, edges: geometryEdges(geometry, 10), key: 'fastener:' + key };
    templates.set(key, template);
    if (templates.size > 128) templates.delete(templates.keys().next().value);
  }
  const f = fastenerFrame(s);
  return {
    ...template,
    local: true,
    matrix: new THREE.Matrix4().makeBasis(f.x, f.y, f.z).setPosition(f.origin),
  };
}
export function fastenerGeometry(s) {
  const template = fastenerDisplayTemplate(s);
  return template.geometry.clone().applyMatrix4(template.matrix);
}
/** Independent geometry/attribute lifetimes, with shared immutable CPU arrays. */
export function sharedGeometryView(source) {
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes))
    geometry.setAttribute(
      name,
      new THREE.BufferAttribute(attribute.array, attribute.itemSize, attribute.normalized),
    );
  if (source.index) geometry.setIndex(new THREE.BufferAttribute(source.index.array, 1));
  geometry.boundingBox = source.boundingBox?.clone() || null;
  geometry.boundingSphere = source.boundingSphere?.clone() || null;
  return geometry;
}
export function holeGeometry(hole) {
  const r = hole.diameter / 2,
    cs = hole.countersink;
  const points = [
    new THREE.Vector2(0, -0.01),
    new THREE.Vector2((cs?.diameter ?? hole.diameter) / 2, -0.01),
  ];
  if (cs) points.push(new THREE.Vector2(cs.diameter / 2, 0), new THREE.Vector2(r, cs.depth));
  points.push(new THREE.Vector2(r, hole.depth + 0.01), new THREE.Vector2(0, hole.depth + 0.01));
  // Keep the cap, cylindrical wall and countersink normals separate. Smoothing
  // across these corners makes CSG fragments look like extra sharp edges.
  const pieces = points
    .slice(1)
    .map((point, i) => new THREE.LatheGeometry([points[i], point], 96).toNonIndexed());
  const geometry = mergeGeometries(pieces);
  pieces.forEach((g) => g.dispose());
  geometry.rotateX(Math.PI / 2);
  const f = hole.frame;
  geometry.applyMatrix4(
    new THREE.Matrix4()
      .makeBasis(
        new THREE.Vector3(...f.u),
        new THREE.Vector3(...f.v),
        new THREE.Vector3(...f.u).cross(new THREE.Vector3(...f.v)),
      )
      .setPosition(new THREE.Vector3(...f.origin)),
  );
  return geometry;
}
