import { componentTransformSources } from '../../components/ownership.js';
import * as THREE from 'three';
import { RotationHandle } from '../../rotation-handle.js';
import { objectAnchors } from '../../model-object.js';
import { rotationCandidates, applyObjectBatch } from '../tools/transform-tool.js';
import { rotateReferencePlacement } from '../../references/reference-placement.js';
export function createRotationController({
  guide,
  host,
  camera,
  scene,
  renderer,
  project,
  tools,
  ui,
  objects,
  getControls,
  isVisible,
  clearPreview,
  validateSweep,
  previewModelBatch,
  fillForm,
  setDrawing,
  checkpoint,
  render,
  syncLocks,
  syncOperationUI,
  getReference,
  previewReference,
  commitReference,
}) {
  const $ = (id) => document.getElementById(id),
    fmt = (n) => n.toLocaleString('sv-SE', { maximumFractionDigits: 3 });
  const rotationHandle = new RotationHandle(host, camera, {
    change: (axis, angle) => {
      if (tools.operation?.mode !== 'rotate' || tools.operation.picking) return;
      tools.operation.axis = axis;
      tools.operation.angle = angle;
      clearPreview();
      if (tools.operation.referenceId) {
        previewReference(
          tools.operation.referenceId,
          rotateReferencePlacement(tools.operation.placement, tools.operation.pivot, axis, angle),
        );
        $('status').textContent = `Rotera referens · ${fmt(angle)}° · Enter bekräftar`;
        return;
      }
      const batch = rotationCandidates(tools.operation, axis, angle);
      const error = batch.map(validateSweep).find(Boolean);
      rotationHandle.error.textContent = error || '';
      if (error) {
        objects.children.forEach((child) => (child.visible = isVisible(child.userData.id)));
        return;
      }
      tools.operation.batch = batch;
      ui.preview = previewModelBatch(batch);
      scene.add(ui.preview);
      // Keep unselected objects visible, and show only the rotated version of the selection.
      // Affected originals were hidden by previewModelBatch.
      if (batch.length === 1) fillForm(batch[0]);
      $('status').textContent = `Rotera runt referenslinjen · ${fmt(angle)}° · Enter bekräftar`;
    },
    pivot: () => restartRotationAxis(),
    commit: () => {
      if (tools.operation?.mode !== 'rotate' || tools.operation.picking) return;
      if (tools.operation.referenceId) {
        const next = rotateReferencePlacement(
          tools.operation.placement,
          tools.operation.pivot,
          tools.operation.axis,
          tools.operation.angle,
        );
        clearPreview();
        checkpoint();
        commitReference(tools.operation.referenceId, next);
        setDrawing(false);
        render();
        $('status').textContent = 'Referensen roterad';
        renderer.domElement.focus({ preventScroll: true });
        return;
      }
      const batch = rotationCandidates(tools.operation);
      const error = batch.map(validateSweep).find(Boolean);
      if (error) {
        rotationHandle.error.textContent = error;
        return;
      }
      if (Math.abs(tools.operation.angle % 360) < 1e-10) {
        setDrawing(false);
        return;
      }
      let next;
      try {
        next = applyObjectBatch(project.objects, batch).objects;
      } catch (error) {
        rotationHandle.error.textContent = error.message;
        return;
      }
      checkpoint();
      project.objects = next;
      setDrawing(false);
      render();
      $('status').textContent = 'Markeringen roterad';
      renderer.domElement.focus({ preventScroll: true });
    },
    dragging: (value) => {
      getControls().enabled = !value;
    },
    step: () => Number(project.snap.rotation ?? 15),
  });
  const rotationLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineDashedMaterial({ color: 0x258e79, depthTest: false, dashSize: 120, gapSize: 60 }),
  );
  rotationLine.visible = false;
  rotationLine.renderOrder = 12;
  scene.add(rotationLine);
  function showRotationLine(start, end) {
    const a = rotationLine.geometry.attributes.position;
    a.setXYZ(0, ...start);
    a.setXYZ(1, ...end);
    a.needsUpdate = true;
    rotationLine.geometry.computeBoundingSphere();
    rotationLine.computeLineDistances();
    rotationLine.visible = true;
  }
  function restartRotationAxis() {
    if (tools.operation?.mode !== 'rotate') return;
    rotationHandle.hide();
    clearPreview();
    tools.operation.batch = null;
    tools.operation.picking = 'start';
    tools.operation.angle = 0;
    tools.first = null;
    tools.axisLock = null;
    tools.activeSnap = null;
    rotationLine.visible = false;
    objects.children.forEach((child) => (child.visible = isVisible(child.userData.id)));
    syncLocks();
    $('status').textContent = 'Rotera · Välj referenslinjens startpunkt';
    renderer.domElement.focus({ preventScroll: true });
  }
  function pickRotationAxis(p) {
    if (tools.operation.picking === 'start') {
      tools.operation.pivot = [...p];
      tools.first = [...p];
      tools.operation.picking = 'end';
      syncLocks();
      showRotationLine(p, p);
      $('status').textContent = 'Rotera · Välj referenslinjens slutpunkt';
    } else {
      const delta = p.map((v, i) => v - tools.operation.pivot[i]);
      if (Math.hypot(...delta) < 1) {
        $('status').textContent = 'Referenslinjen måste vara minst 1 mm lång';
        return;
      }
      tools.operation.axis = delta;
      tools.operation.axisEnd = [...p];
      tools.operation.picking = false;
      tools.first = null;
      tools.axisLock = null;
      tools.activeSnap = null;
      guide.visible = false;
      syncLocks();
      showRotationLine(tools.operation.pivot, p);
      rotationHandle.show(tools.operation.pivot, p);
    }
    renderer.domElement.focus({ preventScroll: true });
  }
  $('rotate').onclick = () => {
    const reference = getReference?.();
    if (reference) {
      setDrawing(true);
      tools.operation = {
        mode: 'rotate',
        referenceId: reference.id,
        placement: structuredClone(reference.placement),
        pivot: [...reference.placement.offset],
        angle: 0,
        picking: 'start',
      };
      syncOperationUI();
      restartRotationAxis();
      return;
    }
    const sources = componentTransformSources(project.objects, ui.selectedIds);
    if (!sources.length) return;
    setDrawing(true);
    tools.operation = {
      mode: 'rotate',
      sources: structuredClone(sources),
      pivot: [...objectAnchors(sources[0])[0]],
      angle: 0,
      picking: 'start',
    };
    syncOperationUI();
    restartRotationAxis();
  };
  return { rotationHandle, rotationLine, showRotationLine, restartRotationAxis, pickRotationAxis };
}
