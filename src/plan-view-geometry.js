import { geometryEdges } from './fasteners/edges.js';

import { sectionDrawing } from './drawing-sections.js';

import { hiddenEdges } from './drawing-hidden-lines.js';

import { referenceCandidates } from './annotation-references.js';

import { partMatrix } from './part-marks.js';
import * as THREE from 'three';
import { objectGeometry, displayGeometry, isPhysical } from './model-object.js';
import { partHoleSchedule, partHoleCandidates } from './fasteners/drawing.js';
import { roundProfile } from './round-profile.js';

import { sectionSegments } from './plan-section.js';
import { sectionContours } from './material-hatch.js';

export function buildPlanObjects({
  bounds,
  group,
  annotationCandidates,
  sections,
  hatchSurfaces,
  objects,
  detail,
  hiddenLines,
  h,
  planes,
}) {
  for (const s of objects.filter(isPhysical)) {
    const g = objectGeometry(s, objects, detail);
    g.computeBoundingBox();
    const b = g.boundingBox;
    if (b.isEmpty() || b.max.z < h.lower || b.min.z > h.upper) {
      g.dispose();
      continue;
    }
    bounds.union(b);
    const edge = geometryEdges(g, roundProfile(s) ? 5 : 1);
    const fill = new THREE.Mesh(
      g,
      new THREE.MeshBasicMaterial({
        color: 0xfbfcfc,
        side: THREE.DoubleSide,
        clippingPlanes: planes(h.lower, h.cut),
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    );
    fill.userData.sourceId = s.id;
    group.add(fill);
    const snapGeometry = displayGeometry(s, objects, 'schematic'),
      snapEdges = geometryEdges(snapGeometry, roundProfile(s) ? 5 : 1),
      pos = snapEdges.attributes.position;
    const objectCandidates = [];
    const identities = [],
      localMatrix = partMatrix(s);
    for (let i = 0; i < pos.count; i += 2) {
      for (const t of [0, 0.5, 1]) {
        const z = pos.getZ(i) * (1 - t) + pos.getZ(i + 1) * t;
        if (z >= h.lower && z <= h.upper) {
          objectCandidates.push([
            pos.getX(i) * (1 - t) + pos.getX(i + 1) * t,
            pos.getY(i) * (1 - t) + pos.getY(i + 1) * t,
          ]);
          const p = objectCandidates.at(-1);
          p.snapKind = t === 0.5 ? 'Mittpunkt' : 'Ändpunkt';
          identities.push(new THREE.Vector3(p[0], p[1], z).applyMatrix4(localMatrix).toArray());
        }
      }
    }
    annotationCandidates.push(...referenceCandidates(objectCandidates, s.id, identities));
    const schedule = partHoleSchedule(s, objects, new THREE.Matrix4()).filter(
      (hole) => hole.center[2] >= h.lower && hole.center[2] <= h.upper,
    );
    for (const hole of partHoleCandidates(schedule, {
      origin: [0, 0, 0],
      x: [1, 0, 0],
      y: [0, 1, 0],
      normal: [0, 0, 1],
    })) {
      hole.point.reference.source = s.id;
      annotationCandidates.push(hole.point);
    }
    snapEdges.dispose();
    snapGeometry.dispose();
    const lines = new THREE.LineSegments(
      edge,
      new THREE.LineBasicMaterial({ color: 0x53666d, clippingPlanes: planes(h.lower, h.cut) }),
    );
    lines.userData.sourceId = s.id;
    lines.renderOrder = 2;
    group.add(lines);
    if (hiddenLines)
      group.add(
        hiddenEdges(edge.clone(), {
          dashSize: 100,
          gapSize: 60,
          clippingPlanes: planes(h.lower, h.cut),
        }),
      );
    const above = new THREE.LineSegments(
      edge.clone(),
      new THREE.LineDashedMaterial({
        color: 0x99a5ab,
        dashSize: 100,
        gapSize: 70,
        depthTest: false,
        clippingPlanes: planes(h.cut + 0.01, h.upper),
      }),
    );
    above.computeLineDistances();
    above.renderOrder = 2;
    group.add(above);
    const cut = sectionSegments(g, h.cut);
    sections.push(...cut);
    hatchSurfaces.push({ contours: sectionContours(cut), material: s.material });
  }
}
export function buildSectionObjects({
  bounds,
  group,
  sections,
  hatchSurfaces,
  annotationCandidates,
  objects,
  detail,
  hiddenLines,
  scale,
  depth,
  matrix,
  planes,
  frame,
}) {
  for (const object of objects.filter((s) => isPhysical(s))) {
    const g = objectGeometry(object, objects, detail).applyMatrix4(matrix);
    g.computeBoundingBox();
    if (g.boundingBox.max.z < -depth || g.boundingBox.min.z > 0) {
      g.dispose();
      continue;
    }
    bounds.union(g.boundingBox);
    const mesh = new THREE.Mesh(
      g,
      new THREE.MeshBasicMaterial({
        color: 0xfbfcfc,
        side: THREE.DoubleSide,
        clippingPlanes: planes,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    );
    mesh.userData.sourceId = object.id;
    group.add(mesh);
    const edges = geometryEdges(g, roundProfile(object) ? 5 : 1),
      lines = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0x53666d, clippingPlanes: planes }),
      );
    lines.userData.sourceId = object.id;
    lines.renderOrder = 2;
    group.add(lines);
    if (hiddenLines)
      group.add(
        hiddenEdges(edges.clone(), {
          dashSize: 2 * scale,
          gapSize: scale,
          clippingPlanes: planes,
        }),
      );
    const snapData = sectionDrawing(
      [g],
      { origin: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], normal: [0, 0, 1], span: frame.span },
      depth,
    );
    sections.push(...snapData.cut);
    hatchSurfaces.push({ contours: snapData.faces[0], material: object.material });
    const snapGeometry = displayGeometry(object, objects, 'schematic').applyMatrix4(matrix);
    const candidates = sectionDrawing(
      [snapGeometry],
      { origin: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], normal: [0, 0, 1], span: frame.span },
      depth,
    );
    snapGeometry.dispose();
    annotationCandidates.push(
      ...referenceCandidates(
        [...candidates.cut, ...candidates.behind].flatMap(([a, b]) => [
          a,
          b,
          [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        ]),
        object.id,
      ),
    );
  }
}
