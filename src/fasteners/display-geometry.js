import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fastenerAccessories } from './accessories.js';

const templates = new Map();
// Canonical display dimensions avoid one GPU batch per microscopic fitting residual.
// The object, drilling, manufacturing geometry and exports never use these rounded values.
const dimension = (n) => Math.round(n * 10000) / 10000;
function displayShape(source) {
  const { spec } = source;
  return {
    bolt: source.assembly?.bolt !== false,
    diameter: dimension(spec.diameter),
    length: dimension(spec.length),
    head: spec.head && {
      kind: spec.head.kind,
      diameter: dimension(spec.head.diameter),
      height: dimension(spec.head.height),
    },
    nut: spec.nut && {
      acrossFlats: dimension(spec.nut.acrossFlats),
      thickness: dimension(spec.nut.thickness),
    },
    washer: spec.washer && {
      innerDiameter: dimension(spec.washer.innerDiameter),
      outerDiameter: dimension(spec.washer.outerDiameter),
      thickness: dimension(spec.washer.thickness),
    },
    accessories: fastenerAccessories(source)
      .map((h) => ({ kind: h.kind, offset: dimension(h.offset) }))
      .sort((a, b) => a.offset - b.offset || a.kind.localeCompare(b.kind)),
  };
}

/** Lightweight surfaces and intentional rims/corners, with no tessellation or hidden bore edges. */
function build(shape, segments) {
  const pieces = [],
    lines = [];
  const r = shape.diameter / 2;
  const edge = (a, b) => lines.push(...a, ...b);
  const rim = (radius, z, count = segments, rotation = 0) => {
    for (let i = 0; i < count; i++) {
      const a = (i * Math.PI * 2) / count + rotation,
        b = ((i + 1) * Math.PI * 2) / count + rotation;
      edge(
        [radius * Math.cos(a), radius * Math.sin(a), z],
        [radius * Math.cos(b), radius * Math.sin(b), z],
      );
    }
  };
  const shell = (top, bottom, depth, offset, count = segments) => {
    const geometry = new THREE.CylinderGeometry(top, bottom, depth, count);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, 0, offset + depth / 2);
    pieces.push(geometry.toNonIndexed());
    geometry.dispose();
  };
  const hex = (radius, depth, offset, head = false) => {
    // The existing bolt head and nut have different polygon orientations.
    const turn = head ? Math.PI / 2 : 0;
    if (head) shell(radius, radius, depth, offset, 6);
    else {
      const polygon = new THREE.Shape(
        Array.from(
          { length: 6 },
          (_, i) =>
            new THREE.Vector2(
              radius * Math.cos((i * Math.PI) / 3),
              radius * Math.sin((i * Math.PI) / 3),
            ),
        ),
      );
      const covered = shape.bolt && offset >= 0 && offset + depth <= shape.length;
      if (!covered) {
        const hole = new THREE.Path();
        hole.absarc(0, 0, r, 0, Math.PI * 2, true);
        polygon.holes.push(hole);
        rim(r, offset);
        rim(r, offset + depth);
      }
      const geometry = new THREE.ExtrudeGeometry(polygon, {
        depth,
        bevelEnabled: false,
        curveSegments: segments / 2,
      });
      geometry.translate(0, 0, offset);
      pieces.push(geometry);
    }
    rim(radius, offset, 6, turn);
    rim(radius, offset + depth, 6, turn);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 + turn;
      edge(
        [radius * Math.cos(a), radius * Math.sin(a), offset],
        [radius * Math.cos(a), radius * Math.sin(a), offset + depth],
      );
    }
  };
  if (shape.bolt) {
    shell(r, r, shape.length, 0);
    if (!shape.head) rim(r, 0);
    rim(r, shape.length);
    if (shape.head) {
      const h = shape.head;
      if (h.kind === 'hex') hex(h.diameter / Math.sqrt(3), h.height, -h.height, true);
      else {
        shell(h.diameter / 2, h.kind === 'countersunk' ? r : h.diameter / 2, h.height, -h.height);
        rim(h.diameter / 2, -h.height);
        if (h.kind !== 'countersunk') rim(h.diameter / 2, 0);
      }
    }
  }
  for (const item of shape.accessories) {
    if (item.kind === 'nut') {
      hex(shape.nut.acrossFlats / Math.sqrt(3), shape.nut.thickness, item.offset);
      continue;
    }
    const inner = shape.washer.innerDiameter / 2,
      outer = shape.washer.outerDiameter / 2,
      z = item.offset,
      end = z + shape.washer.thickness;
    // Separate profile segments keep the planar faces flat and round walls smooth.
    const profile = [
      [inner, z],
      [outer, z],
      [outer, end],
      [inner, end],
      [inner, z],
    ];
    for (let i = 0; i < 4; i++) {
      const geometry = new THREE.LatheGeometry(
        profile.slice(i, i + 2).map(([x, y]) => new THREE.Vector2(x, y)),
        segments,
      );
      geometry.rotateX(Math.PI / 2);
      pieces.push(geometry.toNonIndexed());
      geometry.dispose();
    }
    rim(outer, z);
    rim(outer, end);
    if (!shape.bolt) {
      rim(inner, z);
      rim(inner, end);
    }
  }
  const geometry = pieces.length
    ? mergeGeometries(pieces)
    : new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([], 3));
  pieces.forEach((g) => g.dispose());
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const edges = new THREE.BufferGeometry().setAttribute(
    'position',
    new THREE.Float32BufferAttribute(lines, 3),
  );
  edges.computeBoundingBox();
  edges.computeBoundingSphere();
  return { geometry, edges };
}

export function localFastenerDisplay(source, overview = false) {
  const shape = displayShape(source),
    segments = overview ? 8 : 24;
  const key = `fastener-display:${segments}:${JSON.stringify(shape)}`;
  let template = templates.get(key);
  if (!template) {
    template = { ...build(shape, segments), key };
    templates.set(key, template);
    if (templates.size > 256) templates.delete(templates.keys().next().value);
  }
  return template;
}
