import {
  nextPointSnapSettings,
  nextPointReferenceCandidates,
  acceptsNextPointSnap,
  nextPointSnapLabel,
} from '../next-point-snap.js';
import { displayedSelectionHit, modelSelectionEntry } from '../selection-hit.js';
import { clipSegmentToBox } from '../work-area.js';
import * as THREE from 'three';
import { isCut, isPhysical } from '../../model-object.js';
import { levelElevation } from '../../levels.js';
import { resolveSnap } from '../../snap.js';
import { canSelectModelObject } from '../selection-mode.js';
import { drawingWorkPlane } from '../../work-plane.js';
import { fastenerPlaneFromSurface } from '../../fasteners/placement-frame.js';
import { transformGripSnapPoints } from '../grips.js';

// Converts viewport input into model hits and points using the shared snap engine.
export function createModelPicking({
  project,
  ui,
  tools,
  host,
  camera,
  objects,
  navigation,
  isVisible,
  getRenderedById,
  getSnapIndex,
  getReferences,
  workPlanePrompt,
  getWorkArea = () => null,
  updateSnapOverlay,
}) {
  const $ = (id) => document.getElementById(id);
  const raycaster = new THREE.Raycaster(),
    mouse = new THREE.Vector2();
  raycaster.layers.enable(3);

  let selectionResult;
  function ray(e) {
    selectionResult = undefined;
    camera.updateMatrixWorld();
    const r = host.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, (-(e.clientY - r.top) / r.height) * 2 + 1);
    const pickSize = ((camera.top - camera.bottom) / camera.zoom / host.clientHeight) * 7;
    raycaster.params.Line.threshold = raycaster.params.Points.threshold = pickSize;
    raycaster.setFromCamera(mouse, camera);
  }
  // Screen-space tolerance stays constant while zooming. Only cut edges intercept picks.
  function selectionHit(extraObjects = []) {
    const cursor = new THREE.Vector2(
      ((mouse.x + 1) * host.clientWidth) / 2,
      ((1 - mouse.y) * host.clientHeight) / 2,
    );
    let best = null,
      distance = 7;
    const projectToScreen = (p, i) => {
      const v = new THREE.Vector3().fromBufferAttribute(p, i).project(camera);
      return {
        point: new THREE.Vector2(
          ((v.x + 1) * host.clientWidth) / 2,
          ((1 - v.y) * host.clientHeight) / 2,
        ),
        z: v.z,
      };
    };
    for (const object of objects.children) {
      if (tools.operation?.mode === 'fastenerTargets') continue;
      if (!object.visible || !object.userData.cut || object.userData.component) continue;
      const attributes = [object.children[0].geometry.attributes.position];
      if (object.children[2]?.isLine)
        attributes.push(object.children[2].geometry.attributes.position);
      for (const p of attributes)
        for (let i = 0; i < p.count; i += 2) {
          const segment = clipSegmentToBox(
            new THREE.Vector3().fromBufferAttribute(p, i).toArray(),
            new THREE.Vector3().fromBufferAttribute(p, i + 1).toArray(),
            getWorkArea()?.bounds(),
          );
          if (!segment) continue;
          const attr = new THREE.Float32BufferAttribute(segment.flat(), 3);
          const a = projectToScreen(attr, 0),
            b = projectToScreen(attr, 1);
          if (Math.abs(a.z) > 1 && Math.abs(b.z) > 1) continue;
          const delta = b.point.clone().sub(a.point),
            t = delta.lengthSq()
              ? THREE.MathUtils.clamp(
                  cursor.clone().sub(a.point).dot(delta) / delta.lengthSq(),
                  0,
                  1,
                )
              : 0;
          const d = cursor.distanceTo(a.point.addScaledVector(delta, t));
          if (d < distance) {
            distance = d;
            best = object.userData.id;
          }
        }
    }
    const context = {
      camera,
      width: host.clientWidth,
      height: host.clientHeight,
      pointer: cursor.toArray(),
      workArea: getWorkArea()?.bounds() || null,
    };
    const native = [...objects.children, ...extraObjects].filter(
      (o) =>
        o.visible &&
        (extraObjects.includes(o) ||
          canSelectModelObject(getRenderedById().get(o.userData.id)?.source, ui)) &&
        (camera.layers.test(o.layers) ||
          o.userData.instanced ||
          o.userData.overviewMesh?.userData.detailVisible) &&
        !o.userData.cut &&
        (tools.operation?.mode !== 'fastenerTargets' ||
          (isPhysical(getRenderedById().get(o.userData.id)?.source) &&
            getRenderedById().get(o.userData.id)?.source.type !== 'fastener')),
    );
    const references =
      !tools.operation && !tools.drawing ? getReferences()?.selectionEntries(context) || [] : [];
    const hit = best
      ? { object: { userData: { id: best } } }
      : displayedSelectionHit(
          [...native.map((mesh) => modelSelectionEntry(mesh, camera)), ...references],
          raycaster,
          context,
        );
    if (!extraObjects.length) selectionResult = hit;
    return hit?.object.userData.id ?? null;
  }
  function referenceSelectionHit() {
    if (selectionResult === undefined) selectionHit();
    return getReferences()?.selectionFromHit(selectionResult) || null;
  }

  function point(e) {
    camera.updateMatrixWorld();
    ray(e);
    const placingFastener = tools.operation?.mode === 'fastenerCreate';
    const editingFastenerPlane =
      tools.operation?.gripRefs?.some((ref) => ['end', 'y'].includes(ref.kind)) &&
      tools.operation.sources?.every((source) => source.type === 'fastener');
    let fastenerSurface = null;
    if (placingFastener || editingFastenerPlane) {
      delete tools.operation.surfaceFrame;
      const targets = new Set(
        (placingFastener
          ? tools.operation.draft.holes
          : tools.operation.sources.flatMap((source) => source.holes)
        ).map((h) => h.targetId),
      );
      fastenerSurface = raycaster
        .intersectObjects(
          objects.children.filter((o) => isVisible(o.userData.id) && targets.has(o.userData.id)),
          false,
        )
        .find((hit) => hit.face && (getWorkArea()?.allowsPoint(hit.point.toArray()) ?? true));
    }
    const r = host.getBoundingClientRect();
    const snapStarted = performance.now();
    const snap = nextPointSnapSettings(project.snap, tools.nextPointSnap);
    const snapObjects = (
      getSnapIndex()?.query(camera, r.width, r.height, [e.clientX - r.left, e.clientY - r.top]) ??
      project.objects
    ).filter((s) => isVisible(s.id) && (!isCut(s) || ui.selectedIds.has(s.id)));
    tools.activeSnap = resolveSnap({
      previousSnap: tools.activeSnap,
      pointer: [e.clientX - r.left, e.clientY - r.top],
      camera,
      width: r.width,
      height: r.height,
      ray: raycaster.ray,
      start: tools.first,
      workArea: getWorkArea()?.bounds() || null,
      z: tools.first
        ? tools.first[2]
        : tools.operation?.mode === 'rotate'
          ? tools.operation.pivot[2]
          : levelElevation(project.levels),
      model: project.objects,
      geometryContext: getSnapIndex()?.nearbyContext(
        camera,
        r.width,
        r.height,
        [e.clientX - r.left, e.clientY - r.top],
        tools.first,
        snap.midpoints,
        snap.perpendicular,
        snap.nearest !== false,
      ),
      sweeps: snapObjects,
      grid: { ...project.grid, z: levelElevation(project.levels) },
      referencePoints: nextPointReferenceCandidates(
        [
          ...(getReferences()?.candidates({
            ray: raycaster.ray,
            start: tools.first,
            perpendicular: snap.perpendicular,
            nearest: snap.nearest !== false,
            camera,
            pointer: [e.clientX - r.left, e.clientY - r.top],
            width: r.width,
            height: r.height,
          }) || []),
          ...(snap.endpoints
            ? transformGripSnapPoints(
                project.objects.filter((s) => ui.selectedIds.has(s.id) && isVisible(s.id)),
                ui.selectedIds,
                tools.operation,
              )
            : []),
        ],
        tools.nextPointSnap,
      ),
      endpoints: snap.endpoints,
      cornerSnap: snap.corners,
      quadrantSnap: snap.quadrants,
      midpointSnap: snap.midpoints,
      perpendicularSnap: snap.perpendicular,
      nearestSnap: snap.nearest !== false,
      gridLines: snap.gridLines,
      gridIntersections: snap.gridIntersections,
      gridStepEnabled: snap.gridStepEnabled,
      gridStep: snap.gridStep,
      axisSnap: snap.axes,
      polar: +snap.polar,
      lock: tools.axisLock,
      workPlane: drawingWorkPlane(tools.operation, tools.temporaryPlane),
      constrainToPlane:
        ['plateCreate', 'plateVertex'].includes(tools.operation?.mode) ||
        (!!tools.operation?.gripRefs && !!tools.operation.frame),
    });
    if (import.meta.env?.DEV) {
      host.dataset.snapObjects = snapObjects.length;
      host.dataset.snapMs = (performance.now() - snapStarted).toFixed(1);
    }
    if (
      !tools.nextPointSnap &&
      (tools.operation?.mode === 'workPlane' || tools.operation?.planeId) &&
      tools.activeSnap.kind === 'free'
    ) {
      const hit = raycaster
        .intersectObjects(
          objects.children.filter((o) => o.visible && !o.userData.cut),
          false,
        )
        .find((hit) => getWorkArea()?.allowsPoint(hit.point.toArray()) ?? true);
      if (hit)
        tools.activeSnap = {
          point: hit.point.toArray(),
          kind: 'point',
          symbol: 'cross',
          label: 'Objektyta',
        };
    }
    if (!acceptsNextPointSnap(tools.activeSnap, tools.nextPointSnap)) {
      tools.activeSnap = {
        kind: 'free',
        point: null,
        label: `Nästa punkt: ${nextPointSnapLabel(tools.nextPointSnap)} · ingen träff`,
      };
    }
    if (fastenerSurface) {
      const normal = fastenerSurface.face.normal
        .clone()
        .applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(fastenerSurface.object.matrixWorld));
      if (normal.dot(raycaster.ray.direction) > 0) normal.negate();
      if (!tools.nextPointSnap && (!tools.activeSnap.point || tools.activeSnap.kind === 'free'))
        tools.activeSnap = {
          point: fastenerSurface.point.toArray(),
          kind: 'point',
          symbol: 'cross',
          label: 'Objektyta',
        };
      // A snap on another face/object must not silently acquire this surface's plane.
      const offset =
        tools.activeSnap.point &&
        new THREE.Vector3(...tools.activeSnap.point).sub(fastenerSurface.point);
      if (placingFastener && offset && Math.abs(offset.dot(normal)) < 0.001)
        tools.operation.surfaceFrame = fastenerPlaneFromSurface(
          tools.activeSnap.point,
          normal.toArray(),
          tools.operation.frame,
        );
    }
    $('status').textContent =
      tools.operation?.mode === 'workPlane' ? workPlanePrompt() : tools.activeSnap.label;
    if (tools.operation?.mode === 'workArea' && tools.activeSnap.point)
      tools.activeSnap.point[2] = tools.operation.elevation;
    updateSnapOverlay();
    return tools.activeSnap.point;
  }
  function orbitAroundHit(e) {
    const modified = e.ctrlKey || e.metaKey || e.shiftKey;
    const action = [
      navigation.controls.mouseButtons.LEFT,
      navigation.controls.mouseButtons.MIDDLE,
      navigation.controls.mouseButtons.RIGHT,
    ][e.button];
    const rotates =
      e.pointerType === 'touch'
        ? e.isPrimary && navigation.controls.touches.ONE === THREE.TOUCH.ROTATE
        : (!modified && action === THREE.MOUSE.ROTATE) || (modified && action === THREE.MOUSE.PAN);
    if (!rotates) return;
    ray(e);
    const nativeHit = raycaster
      .intersectObjects(
        objects.children.filter((o) => o.visible && !o.userData.cut),
        false,
      )
      .find((hit) => getWorkArea()?.allowsPoint(hit.point.toArray()) ?? true);
    const referenceHit = getReferences()?.surfaceHit(raycaster);
    const hit =
      referenceHit && (!nativeHit || referenceHit.distance < nativeHit.distance)
        ? referenceHit
        : nativeHit;
    if (!hit) return;
    navigation.movePivot(hit.point);
  }
  return { raycaster, ray, selectionHit, referenceSelectionHit, point, orbitAroundHit };
}
