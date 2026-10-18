import * as THREE from 'three';
import { edgeIndex } from '../edge-index.js';
import { clipSegmentToBox, withinWorkArea } from './work-area.js';
import { nearestProjectedSegment } from './snap-projection.js';

export const EDGE_PICK_PIXELS = 6;
const edgeCache = new WeakMap();
const apertureCache = new WeakMap();

/** CPU-only picking caps reuse the displayed material rings; they are never rendered or exported. */
function holeApertureMesh(mesh) {
  const outline = mesh.children[0]?.geometry;
  const positions = outline?.userData.holeApertures;
  if (!positions?.count) return null;
  let aperture = apertureCache.get(outline);
  if (!aperture) {
    const geometry = new THREE.BufferGeometry().setAttribute('position', positions);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    aperture = new THREE.Mesh(geometry, mesh.material);
    aperture.userData.holeAperture = true;
    apertureCache.set(outline, aperture);
  }
  mesh.updateWorldMatrix(true, false);
  aperture.matrixWorld.copy(mesh.matrixWorld);
  aperture.layers.mask = mesh.layers.mask;
  aperture.material = mesh.material;
  aperture.userData.id = mesh.userData.id;
  return aperture;
}

/** Geometry resources own the cache lifetime; no project or UI state is retained. */
function geometryEdges(geometry) {
  const position = geometry?.attributes.position;
  if (!position) return null;
  let cached = edgeCache.get(position);
  if (!cached || cached.version !== position.version) {
    geometry.computeBoundingBox();
    cached = { bounds: geometry.boundingBox.clone(), version: position.version, position };
    edgeCache.set(position, cached);
  }
  return cached;
}

export function isTransparentMesh(mesh) {
  return (
    mesh.isMesh &&
    ((mesh.userData.transparentView === true && !mesh.userData.opaqueHardware) ||
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).some(
        (material) => material?.visible !== false && material?.transparent && material.opacity < 1,
      ))
  );
}

/** Screen-space feature-edge hit, independent of snap settings and surface raycasting. */
export function featureEdgeHit(mesh, resource, raycaster, context) {
  if (!resource || !context?.camera) return null;
  const { camera, pointer, width, height, workArea = null } = context;
  mesh.updateWorldMatrix(true, false);
  const matrix = mesh.matrixWorld;
  const bounds = (resource.index?.bounds || resource.bounds).clone().applyMatrix4(matrix);
  const span = camera.isPerspectiveCamera
    ? (2 *
        (camera.position.distanceTo(bounds.getCenter(new THREE.Vector3())) +
          bounds.getSize(new THREE.Vector3()).length() / 2) *
        Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) /
      camera.zoom
    : Math.abs(camera.top - camera.bottom) / camera.zoom;
  const radius = (span / height) * EDGE_PICK_PIXELS;
  if (!raycaster.ray.intersectsBox(bounds.clone().expandByScalar(radius))) return null;
  if (!resource.index) {
    const position = resource.position;
    resource.edges = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++)
      new THREE.Vector3().fromBufferAttribute(position, i).toArray(resource.edges, i * 3);
    resource.index = edgeIndex(resource.edges);
  }
  if (!resource.edges.length) return null;
  const inverse = matrix.clone().invert();
  const scale = new THREE.Vector3().setFromMatrixScale(matrix);
  const candidates = resource.index.query(
    raycaster.ray.clone().applyMatrix4(inverse),
    radius / Math.min(scale.x, scale.y, scale.z),
  );
  const frustum = new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
  );
  let best = null;
  for (const i of candidates) {
    let a = new THREE.Vector3().fromArray(resource.edges, i * 6).applyMatrix4(matrix);
    let b = new THREE.Vector3().fromArray(resource.edges, i * 6 + 3).applyMatrix4(matrix);
    const clipped = clipSegmentToBox(a.toArray(), b.toArray(), workArea);
    if (!clipped) continue;
    a.fromArray(clipped[0]);
    b.fromArray(clipped[1]);
    let visible = true;
    for (const plane of frustum.planes) {
      const da = plane.distanceToPoint(a),
        db = plane.distanceToPoint(b);
      if (da < 0 && db < 0) {
        visible = false;
        break;
      }
      if (da < 0 || db < 0) {
        const p = a.clone().lerp(b, da / (da - db));
        if (da < 0) a = p;
        else b = p;
      }
    }
    if (!visible) continue;
    let coords = nearestProjectedSegment(pointer, a.toArray(), b.toArray(), camera, width, height);
    if (!coords) {
      const projectedA = a.clone().project(camera),
        projectedB = b.clone().project(camera);
      if (Math.hypot(projectedA.x - projectedB.x, projectedA.y - projectedB.y) > 1e-10) continue;
      coords =
        a.distanceToSquared(raycaster.ray.origin) < b.distanceToSquared(raycaster.ray.origin)
          ? a.toArray()
          : b.toArray();
    }
    const point = new THREE.Vector3(...coords),
      screen = point.clone().project(camera);
    const screenDistance = Math.hypot(
      ((screen.x + 1) * width) / 2 - pointer[0],
      ((1 - screen.y) * height) / 2 - pointer[1],
    );
    const distance = point.clone().sub(raycaster.ray.origin).dot(raycaster.ray.direction);
    if (screenDistance > EDGE_PICK_PIXELS || distance < raycaster.near || distance > raycaster.far)
      continue;
    const hit = { object: mesh, point, distance, screenDistance };
    if (
      !best ||
      screenDistance < best.screenDistance - 1e-6 ||
      (Math.abs(screenDistance - best.screenDistance) <= 1e-6 && distance < best.distance)
    )
      best = hit;
  }
  return best;
}

/** Native objects and references share edge tolerance, depth ordering and face pass-through. */
export function displayedSelectionHit(entries, raycaster, context) {
  const opaque = entries.filter((entry) => !entry.transparent);
  const opaqueMeshes = opaque.flatMap((entry) =>
    entry.aperture ? [entry.aperture, entry.mesh] : [entry.mesh],
  );
  let edgeRaycaster;
  const surfaces = raycaster
    .intersectObjects(opaqueMeshes, false)
    .filter((hit) => !context?.workArea || withinWorkArea(context.workArea, hit.point.toArray()));
  // Display bodies are unperforated for performance. A coincident opening belongs
  // to its hole group, while actual material in front still occludes it.
  const surface =
    surfaces.find(
      (hit) => hit.object.userData.holeAperture && hit.distance <= surfaces[0].distance + 1e-4,
    ) || surfaces[0];
  let best = null;
  for (const entry of entries) {
    if (!entry.transparent && !entry.edgeSelection) continue;
    const resources = entry.edges || [];
    for (const edge of resources) {
      const hit = featureEdgeHit(
        edge.mesh || entry.mesh,
        edge.resource || geometryEdges(edge.geometry),
        raycaster,
        context,
      );
      if (!hit) continue;
      if (surface && surface.distance < hit.distance - 1e-5) {
        // A tolerated edge lies beside the pointer ray. On an inclined face,
        // comparing their depths falsely treats the face's own rim as hidden.
        edgeRaycaster ??= new THREE.Raycaster();
        edgeRaycaster.layers.mask = raycaster.layers.mask;
        edgeRaycaster.near = raycaster.near;
        edgeRaycaster.far = raycaster.far;
        const projected = hit.point.clone().project(context.camera);
        edgeRaycaster.setFromCamera(new THREE.Vector2(projected.x, projected.y), context.camera);
        const edgeDepth = hit.point
          .clone()
          .sub(edgeRaycaster.ray.origin)
          .dot(edgeRaycaster.ray.direction);
        const blocker = edgeRaycaster
          .intersectObjects(opaqueMeshes, false)
          .find((h) => !context.workArea || withinWorkArea(context.workArea, h.point.toArray()));
        if (blocker && blocker.distance < edgeDepth - 1e-5) continue;
      }
      hit.object = entry.mesh;
      if (
        !best ||
        hit.screenDistance < best.screenDistance - 1e-6 ||
        (Math.abs(hit.screenDistance - best.screenDistance) <= 1e-6 && hit.distance < best.distance)
      )
        best = hit;
    }
  }
  return best || surface || null;
}

/** Follow displayed outlines, including distant proxies and hole rims, for original batch owners. */
export function modelSelectionEntry(mesh, camera) {
  const edges = [];
  const visit = (node) => {
    if (!node.visible) return;
    if (
      node.isLineSegments &&
      (camera.layers.test(node.layers) || mesh.userData.instanced) &&
      node.userData.detailVisible !== false
    )
      edges.push({ mesh: node, geometry: node.geometry });
    for (const child of node.children) visit(child);
  };
  if (mesh.userData.detailVisible === false && mesh.userData.overviewMesh)
    visit(mesh.userData.overviewMesh);
  else
    for (const child of mesh.children) {
      if (!child.userData.overviewProxy) visit(child);
    }
  return {
    mesh,
    transparent: isTransparentMesh(mesh),
    edgeSelection: mesh.userData.edgeSelection || mesh.userData.opaqueHardware,
    aperture: mesh.userData.edgeSelection ? holeApertureMesh(mesh) : null,
    edges,
  };
}
