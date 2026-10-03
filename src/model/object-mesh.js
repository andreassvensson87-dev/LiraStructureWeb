import { helperMesh } from './helper-mesh.js';
import { isHelper } from '../model-object.js';
import * as THREE from 'three';
import { isCut, cutsForModel, geometryForModel, edgesForModel } from '../model-object.js';
import { isLineCut, lineCutFrame } from '../line-cut.js';
import { roundProfile } from '../round-profile.js';
import { objectColor } from '../materials.js';
import { plateVertices } from '../plate.js';
import { isFastener } from '../fasteners/object-type.js';

/** Selection changes only appearance; keep geometries and GPU buffers intact. */
export function updateObjectMeshSelection(object, s, selectedIds) {
  const selected = selectedIds.has(s.id);
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
}
export function createObjectMesh(
  s,
  { model, selectedIds, transparentView = false, ghost = false },
) {
  if (isHelper(s)) return helperMesh(s, { selectedIds, ghost });
  const cut = isCut(s),
    geometry = geometryForModel(s, model),
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
  m.userData.id = s.id;
  m.userData.ghost = ghost;
  const lines = new THREE.LineSegments(
    edgesForModel(
      s,
      model,
      isFastener(s) ? 10 : !cut && !cutsForModel(s, model).length && roundProfile(s) ? 5 : 1,
    ),
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
  m.add(lines);
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
