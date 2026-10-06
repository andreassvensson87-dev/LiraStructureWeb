import * as THREE from 'three';
import { sharedGeometryView } from '../fasteners/geometry.js';

const templates = new Map();
const viewStates = new WeakMap();
export const invalidateDisplayDetail = (objects) => objects && viewStates.delete(objects);
const individuallySelected = (object, ids) => ids.size < 5 && ids.has(object.userData.id);

/** A local envelope keeps placement and overall dimensions in a distant view. */
export function addOverviewMesh(object, descriptor) {
  const triangles =
    (descriptor.geometry.index?.count || descriptor.geometry.attributes.position.count) / 3;
  if (triangles <= 12) return;
  const local = descriptor.geometry.clone();
  if (!descriptor.local) local.applyMatrix4(descriptor.matrix.clone().invert());
  local.computeBoundingBox();
  const bounds = local.boundingBox.clone();
  local.dispose();
  const exactSize = bounds.getSize(new THREE.Vector3());
  // Only the distant display envelope is rounded, to share templates despite
  // Float32 placement noise. Modelling, picking and drawings remain exact.
  for (const axis of ['x', 'y', 'z']) {
    bounds.min[axis] = Math.round(bounds.min[axis] * 100) / 100;
    bounds.max[axis] = Math.round(bounds.max[axis] * 100) / 100;
  }
  const size = bounds.getSize(new THREE.Vector3());
  const key = `overview:${bounds.min.toArray()}:${bounds.max.toArray()}`;
  let template = templates.get(key);
  if (!template) {
    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    geometry.translate(...bounds.getCenter(new THREE.Vector3()).toArray());
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    template = { geometry, edges: new THREE.EdgesGeometry(geometry) };
    templates.set(key, template);
    if (templates.size > 128) templates.delete(templates.keys().next().value);
  }
  const mesh = new THREE.Mesh(sharedGeometryView(template.geometry), object.material.clone());
  mesh.matrix.copy(descriptor.matrix);
  mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
  mesh.add(
    new THREE.LineSegments(sharedGeometryView(template.edges), object.children[0].material.clone()),
  );
  mesh.userData = {
    id: object.userData.id,
    overviewProxy: true,
    lodOwner: object,
    detailVisible: false,
    instanceDescriptor: { key, ...template, matrix: descriptor.matrix, local: true },
  };
  mesh.layers.set(2);
  mesh.children[0].layers.set(2);
  mesh.raycast = () => {};
  mesh.children[0].raycast = () => {};
  object.userData.overviewMesh = mesh;
  object.userData.sectionSize = Math.max(exactSize.y, exactSize.z);
  object.add(mesh);
}

/** Pixel thresholds have hysteresis so small zoom changes do not flicker. */
export function updateDisplayDetail(objects, camera, height, selectedIds) {
  if (!camera.isOrthographicCamera) return;
  const pixelsPerUnit = (height * camera.zoom) / (camera.top - camera.bottom);
  const signature = selectedIds.size < 5 ? JSON.stringify([...selectedIds].sort()) : 'many';
  const state = viewStates.get(objects);
  if (state?.pixelsPerUnit === pixelsPerUnit && state.signature === signature) return;
  viewStates.set(objects, { pixelsPerUnit, signature });
  for (const object of objects) {
    if (object.userData.ghost) continue;
    const proxy = object.userData.overviewMesh;
    const marker = object.userData.holeMesh;
    if (!proxy && !marker) continue;
    const selected = individuallySelected(object, selectedIds);
    if (proxy) {
      const pixels = object.userData.sectionSize * pixelsPerUnit;
      const detailed =
        object.userData.exactProfile ||
        selected ||
        pixels >= (object.userData.detailVisible === false ? 9 : 6);
      object.userData.detailVisible = detailed;
      proxy.userData.detailVisible = !detailed;
      object.layers.set(object.userData.instanced || !detailed ? 3 : 0);
      object.children[0].layers.set(object.userData.instanced || !detailed ? 3 : 0);
      const layer = proxy.userData.instanced ? 3 : detailed ? 2 : 0;
      proxy.layers.set(layer);
      proxy.children[0].layers.set(layer);
    }
    if (marker) {
      const pixels = marker.userData.detailDiameter * pixelsPerUnit;
      marker.userData.detailVisible =
        selected || pixels >= (marker.userData.detailVisible === false ? 2.5 : 1.5);
      marker.layers.set(marker.userData.grouped ? 3 : marker.userData.detailVisible ? 0 : 2);
    }
  }
}

export const displayObjects = (objects) =>
  objects.flatMap((object) =>
    object.userData.overviewMesh ? [object, object.userData.overviewMesh] : [object],
  );
