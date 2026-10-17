import * as THREE from 'three';
import { resetToolLength } from '../tool-session.js';
import { endpointAtLength } from '../../length-input.js';
import { drawingWorkPlane, workPlaneFromPoints, workPlaneFromTwoPoints } from '../../work-plane.js';
import { plateNormal } from '../../plate.js';
import { isHelper } from '../../model-object.js';
import { componentTransformSources } from '../../components/ownership.js';
import { modelTransformSources } from '../tools/transform-sources.js';
import { groupSelection } from '../../fasteners/group-data.js';
import { blockSelection } from '../../blocks/placement.js';
import { gripPoint, validGripRefs } from '../grip-selection.js';
import { moveGripPoints, gripWorkPlane, wholeGripObjects } from '../grips.js';
import { preparePickedFasteners } from '../../fasteners/placement-draft.js';
import { moveReferencePlacement } from '../../references/reference-placement.js';
import { transformCandidates, cloneTransformSource } from '../tools/transform-tool.js';

// Model-space point placement, typed distance and transform interaction.
// Specialised tools supply adapters; selection, snap and history stay shared.
export function createPlacementController({
  project,
  ui,
  tools,
  modelEditor,
  renderer,
  scene,
  guide,
  frameGate,
  workPlaneGuide,
  preview,
  point,
  setDrawing,
  syncOperationUI,
  readForm,
  fillForm,
  updateForm,
  save,
  render,
  checkpoint,
  updateSnapOverlay,
  previewPlatePoint,
  pickPlatePoint,
  showRotationLine,
  getInspector,
  getReferences,
  getItem,
  getBlock,
  getPolysweep,
  getFasteners,
  getGridDraft,
  getLinear = () => null,
  getPlaneTransform = () => null,
  getWorkArea = () => null,
  getPointSelection = () => [],
}) {
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => n.toLocaleString('sv-SE', { maximumFractionDigits: 3 });
  const { clearPreview, validateSweep, previewModelBatch } = preview;
  function resetLength() {
    resetToolLength(tools);
    $('draw-length').value = '';
    $('draw-length-error').textContent = '';
    $('draw-length-form').hidden = true;
  }
  function plateLengthActive() {
    return (
      tools.operation?.mode === 'plateCreate' &&
      !tools.operation.lineCut &&
      !!tools.operation.frame &&
      tools.operation.polygon.length > 0
    );
  }
  function updateTypedLength() {
    const text = $('draw-length').value;
    tools.typedPoint = null;
    $('draw-length-error').textContent = '';
    if (!text.trim()) {
      tools.typedDirection = null;
      if (tools.lastPointer) updatePointer(tools.lastPointer);
      return;
    }
    if (!tools.typedDirection) {
      tools.typedDirection =
        tools.lastDirection?.slice() ??
        (tools.axisLock ? { X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] }[tools.axisLock] : null);
      tools.directionLabel = tools.axisLock
        ? `${tools.axisLock} låst`
        : tools.activeSnap?.label || 'Vald riktning';
    }
    try {
      const end = endpointAtLength(tools.first, tools.typedDirection, text);
      const frame = drawingWorkPlane(tools.operation, tools.temporaryPlane);
      if (
        frame &&
        ['plateCreate', 'plateVertex'].includes(tools.operation?.mode) &&
        Math.abs(
          new THREE.Vector3(...end)
            .sub(new THREE.Vector3(...frame.origin))
            .dot(plateNormal({ frame })),
        ) > 0.001
      )
        throw new Error('Riktningen måste ligga i arbetsplanet.');
      if (plateLengthActive()) {
        const normal = plateNormal(tools.operation);
        if (
          Math.abs(new THREE.Vector3(...end).sub(new THREE.Vector3(...tools.first)).dot(normal)) >
          0.001
        )
          throw new Error('Riktningen måste ligga i arbetsplanet.');
      } else if (!tools.operation?.referenceId) {
        const error = candidates(end).map(validateSweep).find(Boolean);
        if (error) throw new Error(error);
      }
      tools.typedPoint = end;
      tools.activeSnap = {
        point: end,
        label: `${tools.directionLabel} · ${text.trim()} mm`,
        kind: 'direction',
      };
      if (plateLengthActive()) previewPlatePoint(end);
      else showPreview(end);
      updateSnapOverlay();
    } catch (error) {
      clearPreview();
      guide.visible = false;
      tools.activeSnap = null;
      updateSnapOverlay();
      $('draw-length-error').textContent = error.message;
    }
  }
  $('draw-length').addEventListener('input', updateTypedLength);
  $('draw-length-form').onsubmit = (e) => {
    e.preventDefault();
    if (!tools.drawing || !tools.first) return;
    updateTypedLength();
    if (tools.typedPoint && plateLengthActive()) {
      if (pickPlatePoint(tools.typedPoint, true) !== false) tools.nextPointSnap = null;
      updateSnapOverlay();
      renderer.domElement.focus({ preventScroll: true });
    } else if (tools.typedPoint && commitPoint(tools.typedPoint)) {
      renderer.domElement.focus({ preventScroll: true });
    }
  };
  function syncLocks() {
    document.querySelectorAll('[data-axis]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.axis === tools.axisLock));
      b.disabled = !tools.drawing || !tools.first;
    });
  }
  function toggleLock(axis) {
    if (!tools.drawing || !tools.first) return;
    tools.axisLock = tools.axisLock === axis ? null : axis;
    tools.lastDirection = null;
    tools.typedDirection = null;
    tools.typedPoint = null;
    $('draw-length').value = '';
    $('draw-length-error').textContent = '';
    syncLocks();
    if (tools.lastPointer) updatePointer(tools.lastPointer);
  }
  document
    .querySelectorAll('[data-axis]')
    .forEach((b) => (b.onclick = () => toggleLock(b.dataset.axis)));

  function startTransform(mode) {
    const pointRefs =
      mode === 'move' ? validGripRefs(project.objects, getPointSelection(), ui.selectedIds) : [];
    if (pointRefs.length) {
      const source = project.objects.find((o) => o.id === pointRefs[0].id);
      return startGrip({ point: gripPoint(source, pointRefs[0]), refs: pointRefs }, true);
    }
    if (
      ['start', 'end'].includes(mode) &&
      project.objects.some((o) => ui.selectedIds.has(o.id) && o.parametricBlock)
    ) {
      const source = project.objects.find((o) => ui.selectedIds.has(o.id) && o.parametricBlock);
      if (source?.[mode]) startGrip({ point: source[mode], refs: [{ id: source.id, kind: mode }] });
      else $('status').textContent = 'Ändra blockets parametrar i inspektorn eller frigör delarna.';
      return;
    }
    const reference = mode === 'move' && getReferences()?.transformSelection();
    if (reference) {
      setDrawing(true);
      tools.operation = {
        mode,
        referenceId: reference.id,
        placement: structuredClone(reference.placement),
      };
      syncOperationUI();
      $('status').textContent = 'Flytta referens · Välj baspunkt';
      renderer.domElement.focus({ preventScroll: true });
      return;
    }
    const sources = (
      mode === 'start' || mode === 'end' ? componentTransformSources : modelTransformSources
    )(project.objects, ui.selectedIds);
    const source = sources[0];
    if (!source || ((mode === 'start' || mode === 'end') && sources.length !== 1)) return;
    setDrawing(true);
    tools.operation = {
      mode,
      source: cloneTransformSource(source),
      sources: sources.map(cloneTransformSource),
    };
    syncOperationUI();
    if (mode === 'start' || mode === 'end') {
      tools.first = [...source[mode]];
      syncLocks();
      $('draw-length-form').hidden = false;
    }
    if ((mode === 'start' || mode === 'end') && !isHelper(source) && source.type !== 'item')
      getInspector().focusGeometry(mode);
    $('status').textContent =
      mode === 'copy'
        ? 'Kopiera · Välj baspunkt'
        : mode === 'move'
          ? 'Flytta · Välj baspunkt'
          : `Flytta ${mode === 'start' ? 'startpunkt' : 'slutpunkt'}`;
    renderer.domElement.focus({ preventScroll: true });
  }
  function startGrip(grip, pickBase = false) {
    const refs = validGripRefs(project.objects, grip.refs, ui.selectedIds);
    if (!refs.length) return false;
    grip = { ...grip, refs };
    const ids = blockSelection(
      project.objects,
      groupSelection(
        project.objects,
        grip.refs.map((r) => r.id),
      ),
    );
    const members = componentTransformSources(project.objects, ids);
    const whole = wholeGripObjects(members, refs);
    const sources = [
      ...new Map(
        [...members, ...modelTransformSources(project.objects, whole)].map((s) => [s.id, s]),
      ).values(),
    ].map(cloneTransformSource);
    setDrawing(true, { keepPoints: true });
    tools.operation = sources.some((s) =>
      ['baseplate', 'stiffener', 'endplate', 'boltedEndplate', 'beamSplice'].includes(s.kind),
    )
      ? { mode: 'move', sources }
      : {
          mode: pickBase ? 'move' : 'grip',
          sources,
          refs: grip.refs,
          gripRefs: grip.refs,
          gripBase: [...grip.point],
          gripPlane: gripWorkPlane(sources, grip.refs, grip.point),
          frame: pickBase ? null : gripWorkPlane(sources, grip.refs, grip.point),
        };
    $('status').textContent = pickBase
      ? 'Flytta insättningspunkter · Välj baspunkt'
      : 'Flytta insättningspunkter · Välj målpunkt eller ange avstånd';
    tools.first = pickBase ? null : [...grip.point];
    syncOperationUI();
    syncLocks();
    $('draw-length-form').hidden = pickBase;
    renderer.domElement.focus({ preventScroll: true });
    return true;
  }
  function candidates(target) {
    if (tools.operation?.planeId) {
      if (!tools.operation.planeBatch) throw Error('Välj startplan och målplan först.');
      return tools.operation.planeBatch;
    }
    if (tools.operation?.mode === 'polysweepCreate') return [getPolysweep().candidate(target)];
    if (tools.operation?.mode === 'blockCreate') return getBlock().candidate(tools.first, target);
    if (tools.operation?.mode === 'itemCreate') return [getItem().candidate(tools.first, target)];
    if (tools.operation?.mode === 'fastenerCreate') {
      if (tools.operation.error) throw new Error(tools.operation.error);
      tools.operation.previewPoints = [[...tools.first], [...target]];
      return preparePickedFasteners(tools.operation.draft, {
        start: tools.first,
        xPoint: target,
        frame: tools.operation.frame,
        model: project.objects,
      });
    }
    if (tools.operation?.gripRefs || tools.operation?.mode === 'grip')
      return moveGripPoints(
        tools.operation.sources,
        tools.operation.refs,
        target,
        tools.first,
        project.objects,
      );
    if (['helperline', 'gridline'].includes(tools.operation?.mode))
      return [
        {
          type: tools.operation.mode,
          start: [...tools.first],
          end: [...target],
          ...(tools.operation.mode === 'gridline' ? getGridDraft() : {}),
        },
      ];
    return transformCandidates(
      tools.operation,
      tools.first,
      target,
      tools.operation ? null : readForm(),
    );
  }
  function prepareLinear(target) {
    const count = tools.operation.linearCount || 1;
    if (!Number.isInteger(count) || count < 1 || count > 1000) throw Error('Ange 1–1000 kopior.');
    if (tools.operation.mode !== 'copy') return modelEditor.prepare(candidates(target));
    const delta = target.map((v, i) => v - tools.first[i]);
    return modelEditor.prepareCopySeries(
      Array.from({ length: count }, (_, i) =>
        candidates(tools.first.map((v, j) => v + delta[j] * (i + 1))),
      ),
    );
  }
  function previewLinear(target) {
    if (tools.operation?.referenceId) return showPreview(target, false);
    clearPreview();
    guide.visible = false;
    try {
      const result = prepareLinear(target),
        ids = new Set(result.ids);
      const batch = result.objects.filter((object) => ids.has(object.id));
      ui.previewSweep = batch.length === 1 ? batch[0] : null;
      ui.preview = previewModelBatch(batch);
      if (tools.operation.gripRefs) tools.operation.gripPreview = batch;
      scene.add(ui.preview);
      frameGate.invalidate();
      return true;
    } catch (error) {
      if (tools.operation.gripRefs) tools.operation.gripPreview = null;
      clearPreview();
      $('status').textContent = error.message;
      frameGate.invalidate();
      return false;
    }
  }
  function commitPoint(target) {
    const accepted = commitPickedPoint(target);
    if (accepted) tools.nextPointSnap = null;
    return accepted;
  }
  function commitPickedPoint(target) {
    if (tools.operation?.linearId && !tools.operation.referenceId) {
      try {
        const result = prepareLinear(target),
          keepPoints = !!tools.operation.gripRefs;
        modelEditor.replace(result.objects);
        setDrawing(false, { keepPoints });
        render();
        return true;
      } catch (error) {
        $('status').textContent = error.message;
        return false;
      }
    }
    if (tools.operation?.mode === 'polysweepCreate') return getPolysweep().pick(target);
    if (tools.operation?.referenceId) {
      const { referenceId, placement } = tools.operation;
      const next = moveReferencePlacement(placement, tools.first, target);
      clearPreview();
      checkpoint();
      getReferences().setPlacement(referenceId, next);
      setDrawing(false);
      render();
      $('status').textContent = 'Referensen flyttad';
      return true;
    }
    let batch;
    try {
      batch = candidates(target);
      if (tools.operation?.mode === 'fastenerCreate') {
        getFasteners().commitPicked(batch[0]);
        return true;
      }
    } catch (error) {
      $('draw-length-error').textContent = error.message;
      $('status').textContent = error.message;
      return false;
    }
    const error = batch.map(validateSweep).find(Boolean);
    if (error) {
      $('draw-length-error').textContent = error;
      $('error').textContent = error;
      $('inspector-error').textContent = error;
      return false;
    }
    const mode = tools.operation?.mode;
    if (mode === 'blockCreate') {
      try {
        getBlock().commitPlacement(batch);
        return true;
      } catch (error) {
        $('status').textContent = error.message;
        return false;
      }
    }
    if (
      !mode ||
      ['helperline', 'gridline'].includes(mode) ||
      mode === 'fastenerCreate' ||
      mode === 'itemCreate'
    ) {
      if (!save(batch[0])) return false;
      fillForm(project.objects.find((s) => s.id === ui.selected));
    } else {
      let result;
      try {
        result = modelEditor.prepare(batch, { copy: mode === 'copy' });
      } catch (error) {
        $('draw-length-error').textContent = $('status').textContent = error.message;
        return false;
      }
      modelEditor.replace(result.objects);
      if (mode === 'copy') ui.selectedIds = new Set(result.ids);
      ui.selected = ui.selectedIds.size === 1 ? [...ui.selectedIds][0] : null;
      const keepPoints = !!tools.operation?.gripRefs;
      setDrawing(false, { keepPoints });
      render();
    }
    $('status').textContent =
      mode === 'gridline'
        ? 'Stomlinje skapad'
        : mode === 'itemCreate'
          ? 'Item skapad'
          : mode === 'fastenerCreate'
            ? 'Skruv och hål skapade'
            : mode === 'helperline'
              ? 'Hjälplinje skapad'
              : mode === 'copy'
                ? 'Markeringen kopierad'
                : mode
                  ? 'Markeringen flyttad'
                  : 'Sweep skapad';
    return true;
  }
  function showPreview(p, showForm = true) {
    if (tools.operation?.gripRefs) tools.operation.gripPreview = null;
    clearPreview();
    guide.visible = false;
    if (tools.operation?.referenceId) {
      getReferences().previewPlacement(
        tools.operation.referenceId,
        moveReferencePlacement(tools.operation.placement, tools.first, p),
      );
      frameGate.invalidate();
      return true;
    }
    let batch;
    try {
      batch = candidates(p);
    } catch (error) {
      $('draw-length-error').textContent = error.message;
      if (tools.operation?.mode === 'fastenerCreate')
        getFasteners()?.showPickedError?.(error.message);
      return;
    }
    const s = batch[0];
    if (tools.operation?.mode === 'fastenerCreate') getFasteners()?.showPickedFeedback(batch);
    getItem()?.preview(s);
    if (showForm && tools.operation?.mode !== 'fastenerCreate') {
      if (
        tools.operation &&
        !['blockCreate', 'polysweepCreate', 'fastenerCreate'].includes(tools.operation.mode)
      )
        fillForm(s);
      else {
        ['ex', 'ey', 'ez'].forEach((k, i) => ($(k).value = p[i]));
        updateForm();
        if (tools.operation?.mode === 'polysweepCreate') getPolysweep().sync(s);
      }
    }
    if (!batch.some((s) => validateSweep(s))) {
      $('draw-length-error').textContent = '';
      if (tools.operation?.gripRefs) tools.operation.gripPreview = batch;
      ui.previewSweep = batch.length === 1 ? s : null;
      try {
        ui.preview = previewModelBatch(batch);
      } catch (error) {
        if (tools.operation?.gripRefs) tools.operation.gripPreview = null;
        clearPreview();
        $('draw-length-error').textContent = error.message;
        frameGate.invalidate();
        return false;
      }
      scene.add(ui.preview);
      const positions = guide.geometry.attributes.position;
      positions.setXYZ(0, ...tools.first);
      positions.setXYZ(1, ...p);
      positions.needsUpdate = true;
      guide.geometry.computeBoundingSphere();
      guide.computeLineDistances();
      guide.visible = tools.activeSnap.kind === 'direction';
      $('status').textContent =
        s.type === 'item'
          ? `${tools.activeSnap.label} · Fast referenslängd ${fmt(Math.hypot(...s.end.map((v, i) => v - s.start[i])))} mm`
          : `${tools.activeSnap.label} · Längd ${fmt(Math.hypot(...p.map((v, i) => v - tools.first[i])))} mm`;
      frameGate.invalidate();
      return true;
    }
    return false;
  }
  function updatePointer(e) {
    tools.lastPointer = { clientX: e.clientX, clientY: e.clientY };
    if (!tools.drawing) return;
    if (tools.operation?.mode === 'coordinatePoint') {
      point(e);
      return;
    }
    if (tools.operation?.mode === 'workArea') {
      getWorkArea()?.pointerPreview(point(e));
      return;
    }
    if (tools.operation?.planeId) {
      getPlaneTransform()?.pointerPreview(point(e));
      return;
    }
    if (tools.operation?.linearId && !tools.operation.linearPicking) return;
    if (['fastenerTargets', 'fit'].includes(tools.operation?.mode)) return;
    if (tools.operation?.mode === 'workPlane') {
      const p = point(e),
        points = [...tools.operation.points, ...(p ? [p] : [])];
      let frame = null;
      if (points.length === (tools.operation.pointCount || 3)) {
        try {
          frame =
            tools.operation.pointCount === 2
              ? workPlaneFromTwoPoints(points, tools.operation.referenceFrame)
              : workPlaneFromPoints(points);
        } catch {}
      }
      workPlaneGuide.show(points, frame);
      return;
    }
    if (tools.operation?.mode === 'plateCreate' || tools.operation?.mode === 'plateVertex') {
      if (plateLengthActive() && $('draw-length').value.trim()) return;
      const p = point(e);
      if (plateLengthActive() && p) {
        const delta = p.map((v, i) => v - tools.first[i]);
        tools.lastDirection = Math.hypot(...delta) > 1e-8 ? delta : null;
      }
      if (p) previewPlatePoint(p);
      return;
    }
    if (tools.operation?.mode === 'rotate') {
      if (tools.operation.picking) {
        const p = point(e);
        if (tools.first && p) showRotationLine(tools.first, p);
      }
      return;
    }
    if (tools.first && $('draw-length').value.trim()) return;
    const p = point(e);
    if (tools.operation?.linearId) {
      getLinear()?.pointerPreview(p);
      return;
    }
    clearPreview();
    guide.visible = false;
    if (!p || !tools.first) {
      tools.lastDirection = null;
      return;
    }
    const delta = p.map((v, i) => v - tools.first[i]);
    tools.lastDirection = Math.hypot(...delta) > 1e-8 ? delta : null;
    showPreview(p);
  }

  return {
    previewLinear,
    previewPlane: (batch) => {
      clearPreview();
      guide.visible = false;
      try {
        modelEditor.prepare(batch, { copy: tools.operation?.mode === 'copy' });
        ui.previewSweep = batch.length === 1 ? batch[0] : null;
        ui.preview = previewModelBatch(batch);
        scene.add(ui.preview);
        frameGate.invalidate();
        return true;
      } catch (error) {
        $('status').textContent = error.message;
        return false;
      }
    },
    clearTransformPreview: () => {
      if (tools.operation?.gripRefs) tools.operation.gripPreview = null;
      clearPreview();
      guide.visible = false;
      tools.activeSnap = null;
      updateSnapOverlay();
      frameGate.invalidate();
    },
    resetLength,
    plateLengthActive,
    updateTypedLength,
    syncLocks,
    toggleLock,
    startTransform,
    startGrip,
    commitPoint,
    updatePointer,
  };
}
