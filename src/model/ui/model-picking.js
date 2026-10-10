import * as THREE from 'three';
import { isCut, isPhysical } from '../../model-object.js';
import { levelElevation } from '../../levels.js';
import { resolveSnap } from '../../snap.js';
import { drawingWorkPlane } from '../../work-plane.js';

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
  updateSnapOverlay,
}) {
  const $ = (id) => document.getElementById(id);
  const raycaster = new THREE.Raycaster(),
    mouse = new THREE.Vector2();
  raycaster.layers.enable(3);

  function ray(e) {
    camera.updateMatrixWorld();
    const r = host.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, (-(e.clientY - r.top) / r.height) * 2 + 1);
    const pickSize = ((camera.top - camera.bottom) / camera.zoom / host.clientHeight) * 7;
    raycaster.params.Line.threshold = raycaster.params.Points.threshold = pickSize;
    raycaster.setFromCamera(mouse, camera);
  }
  // Screen-space tolerance stays constant while zooming. Only cut edges intercept picks.
  function selectionHit() {
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
          const a = projectToScreen(p, i),
            b = projectToScreen(p, i + 1);
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
    return (
      best ??
      raycaster.intersectObjects(
        objects.children.filter(
          (o) =>
            o.visible &&
            (camera.layers.test(o.layers) || o.userData.instanced) &&
            !o.userData.cut &&
            (tools.operation?.mode !== 'fastenerTargets' ||
              (isPhysical(getRenderedById().get(o.userData.id)?.source) &&
                getRenderedById().get(o.userData.id)?.source.type !== 'fastener')),
        ),
        false,
      )[0]?.object.userData.id ??
      null
    );
  }
  function point(e) {
    camera.updateMatrixWorld();
    ray(e);
    const r = host.getBoundingClientRect();
    const snapStarted = performance.now();
    const snapObjects = (
      getSnapIndex()?.query(camera, r.width, r.height, [e.clientX - r.left, e.clientY - r.top]) ??
      project.objects
    ).filter((s) => isVisible(s.id) && (!isCut(s) || ui.selectedIds.has(s.id)));
    tools.activeSnap = resolveSnap({
      pointer: [e.clientX - r.left, e.clientY - r.top],
      camera,
      width: r.width,
      height: r.height,
      ray: raycaster.ray,
      start: tools.first,
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
        project.snap.midpoints,
        project.snap.perpendicular,
      ),
      sweeps: snapObjects,
      grid: { ...project.grid, z: levelElevation(project.levels) },
      referencePoints:
        getReferences()?.candidates({
          ray: raycaster.ray,
          camera,
          pointer: [e.clientX - r.left, e.clientY - r.top],
          width: r.width,
          height: r.height,
        }) || [],
      endpoints: project.snap.endpoints,
      cornerSnap: project.snap.corners,
      quadrantSnap: project.snap.quadrants,
      midpointSnap: project.snap.midpoints,
      perpendicularSnap: project.snap.perpendicular,
      gridLines: project.snap.gridLines,
      gridIntersections: project.snap.gridIntersections,
      gridStepEnabled: project.snap.gridStepEnabled,
      gridStep: project.snap.gridStep,
      axisSnap: project.snap.axes,
      polar: +project.snap.polar,
      lock: tools.axisLock,
      workPlane: drawingWorkPlane(tools.operation, tools.temporaryPlane),
      constrainToPlane: ['plateCreate', 'plateVertex'].includes(tools.operation?.mode),
    });
    if (import.meta.env.DEV) {
      host.dataset.snapObjects = snapObjects.length;
      host.dataset.snapMs = (performance.now() - snapStarted).toFixed(1);
    }
    if (tools.operation?.mode === 'workPlane' && tools.activeSnap.kind === 'free') {
      const hit = raycaster.intersectObjects(
        objects.children.filter((o) => o.visible && !o.userData.cut),
        false,
      )[0];
      if (hit)
        tools.activeSnap = {
          point: hit.point.toArray(),
          kind: 'point',
          symbol: 'cross',
          label: 'Objektyta',
        };
    }
    $('status').textContent =
      tools.operation?.mode === 'workPlane' ? workPlanePrompt() : tools.activeSnap.label;
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
    const hit = raycaster.intersectObjects(
      objects.children.filter((o) => o.visible && !o.userData.cut),
      false,
    )[0];
    if (!hit) return;
    navigation.movePivot(hit.point);
  }
  return { raycaster, ray, selectionHit, point, orbitAroundHit };
}
