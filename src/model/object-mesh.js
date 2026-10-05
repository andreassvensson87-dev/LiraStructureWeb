import { addOverviewMesh } from './display-detail.js';
import { helperMesh } from './helper-mesh.js';
import { isHelper } from '../model-object.js';
import * as THREE from 'three';
import {
  isCut,
  displayGeometry,
  displayFastenerTemplate,
  edgesForModel,
  objectInstanceDescriptor,
  cachedDisplayGeometryIdentity,
  cachedDisplayHasCuts,
} from '../model-object.js';
import { isLineCut, lineCutFrame } from '../line-cut.js';
import { roundProfile } from '../round-profile.js';
import { objectColor } from '../materials.js';
import { plateVertices } from '../plate.js';
import { sharedGeometryView } from '../fasteners/geometry.js';
import { isFastener } from '../fasteners/object-type.js';
import { holesForPart } from '../fasteners/relations.js';
import { holeDisplayMesh } from '../fasteners/display.js';

/** Change display mode without replacing model geometry or selection state. */
export function updateObjectMeshTransparency(object, transparentView) {
  if (object.userData.helper || object.userData.cut || object.userData.ghost) return;
  object.userData.transparentView = transparentView;
  const material = object.material;
  material.transparent = transparentView;
  material.opacity = transparentView ? 0.3 : 1;
  material.depthWrite = !transparentView;
  material.needsUpdate = true;
  const outline = object.children[0]?.material;
  if (outline) {
    outline.transparent = transparentView;
    outline.opacity = transparentView ? 0.35 : 0.55;
    outline.depthWrite = !transparentView;
    outline.needsUpdate = true;
  }
  const proxy = object.userData.overviewMesh;
  if (proxy) {
    proxy.material.transparent = material.transparent;
    proxy.material.opacity = material.opacity;
    proxy.material.depthWrite = material.depthWrite;
    proxy.material.needsUpdate = true;
    proxy.children[0].material.copy(outline);
  }
  for (const child of object.children.filter((c) => c.userData.holeMarker)) {
    child.material.transparent = transparentView;
    child.material.opacity = transparentView ? 0.65 : 1;
    child.material.depthWrite = !transparentView;
    child.material.needsUpdate = true;
  }
}

/** Selection changes only appearance; keep geometries and GPU buffers intact. */
export function updateObjectMeshSelection(object, s, selectedIds) {
  const selected = selectedIds.has(s.id);
  if (object.userData.selected === selected) return;
  object.userData.selected = selected;
  if (object.userData.helper) {
    object.material.color.set(selected || object.userData.ghost ? 0x258e79 : 0x8765ad);
    return;
  }
  const cut = object.userData.cut;
  object.material.color.set(cut ? 0xd57c40 : selected ? 0x359e83 : objectColor(s));
  if (cut) object.material.opacity = selected ? 0.2 : 0;
  const outline = object.children[0];
  outline.material.color.set(
    cut ? (selected ? 0xe87924 : 0xb77a48) : selected ? 0x145d4d : 0x3e5663,
  );
  if (cut) outline.material.opacity = selected ? 1 : 0.8;
  const proxy = object.userData.overviewMesh;
  if (proxy) {
    proxy.material.color.copy(object.material.color);
    proxy.children[0].material.color.copy(outline.material.color);
  }
}
export function createObjectMesh(
  s,
  { model, selectedIds, transparentView = false, ghost = false, geometryContext = null },
) {
  if (isHelper(s)) return helperMesh(s, { selectedIds, ghost });
  const template = isFastener(s)
    ? geometryContext?.fastenerTemplate
      ? geometryContext.fastenerTemplate(s)
      : displayFastenerTemplate(s, model)
    : null;
  const worldGeometry = template ? null : geometryContext?.geometry(s) || displayGeometry(s, model);
  const cut = isCut(s),
    geometry = template ? sharedGeometryView(template.geometry) : worldGeometry,
    m = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        side: isLineCut(s) ? THREE.DoubleSide : THREE.FrontSide,
        color: cut
          ? 0xd57c40
          : ghost
            ? 0x359e83
            : selectedIds.has(s.id)
              ? 0x359e83
              : objectColor(s),
        roughness: 0.7,
        metalness: 0.12,
        depthWrite: !cut && (ghost || !transparentView),
        transparent: ghost || cut || transparentView,
        opacity: cut
          ? selectedIds.has(s.id) || ghost
            ? 0.2
            : 0
          : ghost
            ? 0.45
            : transparentView
              ? 0.3
              : 1,
      }),
    );
  if (template) {
    m.matrix.copy(template.matrix);
    m.matrix.decompose(m.position, m.quaternion, m.scale);
    m.updateMatrixWorld();
  }
  if (isFastener(s))
    m.userData.detailDiameter = Math.max(
      s.spec.head.diameter,
      s.spec.diameter,
      s.spec.nut?.acrossFlats || 0,
      s.spec.washer?.outerDiameter || 0,
    );
  // Pay the initial bounds cost while building, rather than on the first click.
  geometry.computeBoundingSphere();
  m.userData.geometryIdentity = cachedDisplayGeometryIdentity(s);
  m.userData.transparentView = transparentView;
  m.userData.id = s.id;
  m.userData.ghost = ghost;
  m.userData.selected = selectedIds.has(s.id);
  const lines = new THREE.LineSegments(
    template
      ? sharedGeometryView(template.edges)
      : geometryContext
        ? geometryContext.edges(s, isFastener(s) ? 10 : !cut && roundProfile(s) ? 5 : 1)
        : edgesForModel(s, model, isFastener(s) ? 10 : !cut && roundProfile(s) ? 5 : 1, true),
    new THREE.LineBasicMaterial({
      color: cut
        ? selectedIds.has(s.id)
          ? 0xe87924
          : 0xb77a48
        : selectedIds.has(s.id)
          ? 0x145d4d
          : 0x3e5663,
      depthTest: !cut,
      transparent: ghost || cut,
      opacity: cut ? (selectedIds.has(s.id) ? 1 : 0.8) : ghost ? 0.5 : 0.55,
    }),
  );
  lines.renderOrder = cut ? 20 : 0;
  m.userData.cut = cut;
  if (!ghost && !cut) m.userData.instanceDescriptor = template || objectInstanceDescriptor(s, true);
  m.add(lines);
  const holes = cut || isFastener(s) ? [] : geometryContext?.holes(s) || holesForPart(s, model);
  m.userData.holes = holes;
  const holeMesh = holeDisplayMesh(s, model, holes, transparentView, ghost, geometryContext);
  if (holeMesh) {
    m.userData.holeMesh = holeMesh;
    m.add(holeMesh);
  }
  if (
    !ghost &&
    !cut &&
    (s.type || 'sweep') === 'sweep' &&
    m.userData.instanceDescriptor &&
    !cachedDisplayHasCuts(s)
  )
    addOverviewMesh(m, m.userData.instanceDescriptor);
  if (!ghost && !cut) updateObjectMeshTransparency(m, transparentView);
  if (isLineCut(s)) {
    const f = lineCutFrame(s),
      arrow = new THREE.ArrowHelper(
        f.n.clone().multiplyScalar(s.side === 'positive' ? 1 : -1),
        f.origin.clone().addScaledVector(f.u, f.length / 2),
        Math.min(400, f.length * 0.3),
        0xe87924,
      );
    arrow.line.material.depthTest = false;
    arrow.cone.material.depthTest = false;
    m.add(arrow);
    const reference = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        plateVertices(s).map((p) => new THREE.Vector3(...p)),
      ),
      new THREE.LineBasicMaterial({ color: 0xe87924, depthTest: false }),
    );
    reference.renderOrder = 21;
    m.add(reference);
  }
  return m;
}
