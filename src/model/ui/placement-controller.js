import * as THREE from 'three';
import { resetToolLength } from '../tool-session.js';
import { endpointAtLength } from '../../length-input.js';
import { drawingWorkPlane, workPlaneFromPoints } from '../../work-plane.js';
import { plateNormal } from '../../plate.js';
import { isHelper } from '../../model-object.js';
import { componentTransformSources } from '../../components/ownership.js';
import { groupSelection } from '../../fasteners/group-data.js';
import { moveGripPoints } from '../grips.js';
import { alignFastenerGroup, fastenerGroupBatch } from '../../fasteners/groups.js';
import { axisPlacement } from '../../fasteners/geometry.js';
import { resolveFastenerHoles } from '../../fasteners/placement.js';
import { moveReferencePlacement } from '../../references/reference-placement.js';
import { transformCandidates } from '../tools/transform-tool.js';

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
  getFasteners,
  getGridDraft,
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
      pickPlatePoint(tools.typedPoint, true);
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
    const sources = componentTransformSources(project.objects, ui.selectedIds);
    const source = sources[0];
    if (!source || ((mode === 'start' || mode === 'end') && sources.length !== 1)) return;
    setDrawing(true);
    tools.operation = { mode, source: structuredClone(source), sources: structuredClone(sources) };
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
  function startGrip(grip) {
    const ids = groupSelection(
      project.objects,
      grip.refs.map((r) => r.id),
    );
    const sources = structuredClone(componentTransformSources(project.objects, ids));
    setDrawing(true);
    tools.operation = sources.some(
      (s) =>
        s.group ||
        ['baseplate', 'stiffener', 'endplate', 'boltedEndplate', 'beamSplice'].includes(s.kind),
    )
      ? { mode: 'move', sources }
      : { mode: 'grip', sources, refs: grip.refs };
    $('status').textContent = 'Flytta insättningspunkter · Välj målpunkt eller ange avstånd';
    tools.first = [...grip.point];
    syncOperationUI();
    syncLocks();
    $('draw-length-form').hidden = false;
    renderer.domElement.focus({ preventScroll: true });
  }
  function candidates(target) {
    if (tools.operation?.mode === 'itemCreate') return [getItem().candidate(tools.first, target)];
    if (tools.operation?.mode === 'fastenerCreate') {
      const draft = tools.operation.draft;
      if (draft.group)
        return fastenerGroupBatch(alignFastenerGroup(draft, tools.first, target), project.objects, {
          fit: false,
        });
      return [
        {
          ...draft,
          ...axisPlacement(draft.spec, tools.first, target),
          ...(draft.placementMode === 'range'
            ? {
                insertion: {
                  start: [...tools.first],
                  direction: [...target],
                  depth: draft.drillDepth,
                },
              }
            : {}),
        },
      ];
    }
    if (tools.operation?.mode === 'grip')
      return moveGripPoints(tools.operation.sources, tools.operation.refs, target);
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
  function commitPoint(target) {
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
      if (
        tools.operation?.mode === 'fastenerCreate' &&
        tools.operation.draft.placementMode === 'range'
      ) {
        clearPreview();
        tools.first = null;
        tools.operation = { mode: 'fastenerDepth', draft: batch[0] };
        $('draw-length-form').hidden = true;
        getFasteners().sync([], tools.operation);
        getInspector().show('properties');
        $('status').textContent = batch[0].group
          ? 'Kontrollera skruvgruppen · Enter skapar gruppen och dess hål'
          : 'Kontrollera förbandet · Enter skapar skruv och hål';
        getFasteners().placeForm.querySelector('[type=submit]').focus();
        return true;
      }
      if (tools.operation?.mode === 'fastenerCreate')
        batch = batch.map((s) => resolveFastenerHoles(s, project.objects));
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
      setDrawing(false);
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
  function showPreview(p) {
    clearPreview();
    guide.visible = false;
    if (tools.operation?.referenceId) {
      getReferences().previewPlacement(
        tools.operation.referenceId,
        moveReferencePlacement(tools.operation.placement, tools.first, p),
      );
      frameGate.invalidate();
      return;
    }
    let batch;
    try {
      batch = candidates(p);
    } catch (error) {
      $('draw-length-error').textContent = error.message;
      return;
    }
    const s = batch[0];
    getItem()?.preview(s);
    if (tools.operation) fillForm(s);
    else {
      ['ex', 'ey', 'ez'].forEach((k, i) => ($(k).value = p[i]));
      updateForm();
    }
    if (!batch.some((s) => validateSweep(s))) {
      $('draw-length-error').textContent = '';
      ui.previewSweep = batch.length === 1 ? s : null;
      ui.preview = previewModelBatch(batch);
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
    }
  }
  function updatePointer(e) {
    tools.lastPointer = { clientX: e.clientX, clientY: e.clientY };
    if (!tools.drawing) return;
    if (['fastenerTargets', 'fastenerDepth', 'fit'].includes(tools.operation?.mode)) return;
    if (tools.operation?.mode === 'workPlane') {
      const p = point(e),
        points = [...tools.operation.points, ...(p ? [p] : [])];
      let frame = null;
      if (points.length === 3) {
        try {
          frame = workPlaneFromPoints(points);
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
