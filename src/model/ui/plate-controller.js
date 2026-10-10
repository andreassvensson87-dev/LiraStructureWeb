import * as THREE from 'three';
import { isCut, isPlate, validateObject } from '../../model-object.js';
import { isLineCut, lineCutFrame } from '../../line-cut.js';
import { platePoint, plateLocal, plateArea, plateNormal, plateVertices } from '../../plate.js';
import { editPlateVertex } from '../../plate-vertices.js';
import { nextIdentity } from '../../object-identity.js';
import { advancePlatePoint } from '../tools/plate-tool.js';
export function createPlateController({
  modelEditor,
  project,
  tools,
  ui,
  scene,
  objects,
  host,
  camera,
  renderer,
  guide,
  remove,
  getInspector,
  select,
  setDrawing,
  syncOperationUI,
  syncMaterialPanel,
  syncLocks,
  resetLength,
  plateLengthActive,
  validateSweep,
  render,
  previewModelBatch,
  clearPreview,
  dispose,
  remember,
  restoreDefaults,
  syncPropertyUI,
}) {
  const $ = (id) => document.getElementById(id),
    fmt = (n) => n.toLocaleString('sv-SE', { maximumFractionDigits: 3 });
  const plateNormalArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(),
    1,
    0x258e79,
  );
  plateNormalArrow.visible = false;
  plateNormalArrow.line.material.depthTest = false;
  plateNormalArrow.cone.material.depthTest = false;
  plateNormalArrow.renderOrder = 12;
  scene.add(plateNormalArrow);
  function updatePlateNormal() {
    const s =
      tools.operation?.mode === 'plateCreate' && tools.operation.frame
        ? tools.operation
        : !tools.operation
          ? project.objects.find((s) => s.id === ui.selected)
          : null;
    plateNormalArrow.visible =
      !!s &&
      !s.generatedBy &&
      !isLineCut(s) &&
      !s.lineCut &&
      (isPlate(s) || s.mode === 'plateCreate');
    if (!plateNormalArrow.visible) return;
    const points = s.polygon ?? [],
      center = points.length
        ? points.reduce(
            (sum, p) => [sum[0] + p[0] / points.length, sum[1] + p[1] / points.length],
            [0, 0],
          )
        : [0, 0];
    plateNormalArrow.position.fromArray(platePoint(s, center));
    plateNormalArrow.setDirection(
      isLineCut(s)
        ? lineCutFrame(s).n.multiplyScalar(s.side === 'positive' ? 1 : -1)
        : plateNormal(s),
    );
    const length = ((camera.top - camera.bottom) / camera.zoom / host.clientHeight) * 44;
    plateNormalArrow.setLength(length, length * 0.22, length * 0.1);
  }
  let plateOutline = null;
  function clearPlateOutline() {
    if (plateOutline) {
      scene.remove(plateOutline);
      dispose(plateOutline);
      plateOutline = null;
    }
  }
  function plateValues() {
    if (tools.operation?.lineCut || isLineCut(project.objects.find((s) => s.id === ui.selected)))
      return { side: $('plate-side').value };
    return {
      thickness: +$('plate-thickness').value,
      side: $('plate-side').value,
      ...(!tools.operation?.cutTargets ? { contourOffset: +$('plate-contour-offset').value } : {}),
    };
  }
  function syncPlateUI() {
    const s = project.objects.find((s) => s.id === ui.selected),
      cut = isCut(s) || !!tools.operation?.cutTargets,
      line = isLineCut(s) || !!tools.operation?.lineCut,
      creating = tools.operation?.mode === 'plateCreate',
      editing = tools.operation?.mode === 'plateVertex',
      plate = creating || editing || isPlate(s);
    $('plate-form').hidden = !plate || ui.selectedIds.size > 1;
    $('form').hidden = plate || ui.selectedIds.size > 1;
    $('object-heading').textContent =
      ui.selectedIds.size > 1
        ? 'Objekt'
        : plate
          ? line
            ? 'Linecut'
            : cut
              ? 'Polygoncut'
              : 'Plate'
          : 'Sweep';
    $('plate-geometry').querySelector('summary').textContent = line
      ? 'Geometri · snittlinje'
      : 'Geometri · polygonhörn';
    $('plate-thickness').closest('label').hidden = line;
    $('plate-thickness').disabled = line;
    $('plate-side-label').textContent = line ? 'Sida som tas bort' : 'Placering';
    $('plate-side').querySelector('[value=center]').hidden = line;
    $('plate-depth-label').textContent = cut ? 'Skärdjup' : 'Tjocklek';
    $('plate-plane-fields').hidden = !creating || !!tools.temporaryPlane;
    $('plate-plane').disabled = creating && !!tools.operation.frame;
    $('plate-contour-offset-field').hidden = line || cut;
    $('plate-contour-offset').disabled = line || cut;
    $('plate-new').hidden = creating || editing;
    $('plate-delete').hidden = creating || editing || !isPlate(s);
    $('plate-apply').hidden = editing;
    $('plate-apply').textContent = creating
      ? line
        ? 'Bekräfta Linecut ↵'
        : 'Slut polygon ↵'
      : 'Uppdatera Plate';
    $('plate-apply').disabled =
      creating &&
      (!tools.operation.frame ||
        tools.operation.polygon.length < (tools.operation.lineCut ? 2 : 3));
    if (creating) {
      $('plate-vertices').replaceChildren();
      $('plate-stage').textContent = !tools.operation.frame
        ? tools.operation.planeMode === 'three'
          ? `Välj planpunkt ${tools.operation.planePoints.length + 1} av 3`
          : 'Välj första hörnet – arbetsplanet går genom punkten'
        : `${tools.operation.polygon.length} hörn · Klicka första hörnet eller Enter för att sluta`;
      $('mode-label').textContent = line ? 'Ny Linecut' : cut ? 'Ny Polygoncut' : 'Ny Plate';
    }
    if (line && creating && tools.operation.frame)
      $('plate-stage').textContent =
        tools.operation.polygon.length < 2
          ? 'Välj snittlinjens andra punkt'
          : tools.operation.sidePicked
            ? 'Enter bekräftar · Pilen visar sidan som tas bort'
            : 'Klicka sidan som ska tas bort, eller välj skärsida';
    else if (editing)
      $('plate-stage').textContent = `Flytta hörn ${tools.operation.index + 1} i arbetsplanet`;
    else if (isLineCut(s))
      $('plate-stage').textContent = 'Två punkter · Pilen visar sidan som tas bort';
    else if (isPlate(s))
      $('plate-stage').textContent =
        `${s.polygon.length} hörn · ${fmt(plateArea(s) / 1e6)} m² · Pilen visar positiv sida`;
    if (!tools.operation) {
      document
        .querySelectorAll('#plate-vertices .plate-vertex-row, #sweep-geometry fieldset')
        .forEach((row) => (row.hidden = false));
    }
    if (creating) {
      $('draw-length-form').hidden = !plateLengthActive();
      if (plateLengthActive()) {
        $('distance-label').textContent = 'Sidlängd';
        $('draw-length-form').querySelector('[type=submit]').textContent = 'Nästa hörn ↵';
      }
    }
    getInspector()?.sync();
    syncPropertyUI?.();
  }
  function fillPlate(s) {
    $('plate-contour-offset').value = s.contourOffset ?? 0;
    if (!isLineCut(s)) $('plate-thickness').value = s.thickness;
    $('plate-side').value = s.side;
    $('plate-error').textContent = '';
    $('plate-vertices').replaceChildren();
    s.polygon.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'plate-vertex-row';
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = String(i + 1);
      button.title = `Flytta hörn ${i + 1} med snap`;
      button.onclick = () => startPlateVertex(i);
      row.append(button);
      p.forEach((v, j) => {
        const label = document.createElement('label');
        label.textContent = j ? 'V · mm' : 'U · mm';
        const input = document.createElement('input');
        input.type = 'number';
        input.step = 'any';
        input.required = true;
        input.value = String(Math.round(v * 1e6) / 1e6);
        input.dataset.vertex = i;
        input.dataset.component = j;
        input.setAttribute('aria-label', `Hörn ${i + 1} ${j ? 'V' : 'U'}`);
        label.append(input);
        row.append(label);
      });
      $('plate-vertices').append(row);
    });
  }
  function startPlate(cutTargets = null, lineCut = false) {
    if (!Array.isArray(cutTargets)) cutTargets = null;
    getInspector()?.finish();
    if (!cutTargets && !lineCut) {
      remember?.(project.objects.find((s) => s.id === ui.selected));
    }
    select(null);
    if (!cutTargets && !lineCut) restoreDefaults?.();
    setDrawing(true);
    tools.operation = {
      mode: 'plateCreate',
      lineCut,
      cutTargets,
      planeMode: $('plate-plane').value,
      planePoints: [],
      polygon: [],
      frame: tools.temporaryPlane ? structuredClone(tools.temporaryPlane) : null,
    };
    if (lineCut) $('plate-side').value = 'positive';
    $('plate-error').textContent = '';
    syncOperationUI();
    syncPlateUI();
    syncMaterialPanel();
    getInspector().show('properties');
    renderer.domElement.focus({ preventScroll: true });
  }
  function draftPlate(polygon = tools.operation.polygon) {
    return {
      type: tools.operation.lineCut
        ? 'linecut'
        : tools.operation.cutTargets
          ? 'polygoncut'
          : 'plate',
      ...(tools.operation.cutTargets
        ? { id: 'cut-preview', targets: [...tools.operation.cutTargets] }
        : {}),
      frame: structuredClone(tools.operation.frame),
      polygon: structuredClone(polygon),
      ...plateValues(),
    };
  }
  function previewPlatePoint(p) {
    clearPreview();
    clearPlateOutline();
    guide.visible = false;
    if (tools.operation.mode === 'plateVertex') {
      const s = {
        ...tools.operation.source,
        polygon: tools.operation.source.polygon.map((v, i) =>
          i === tools.operation.index && p ? plateLocal(tools.operation.source, p) : v,
        ),
      };
      const error = validateObject(s);
      $('plate-error').textContent = error;
      if (!error) {
        try {
          ui.preview = previewModelBatch([s]);
          scene.add(ui.preview);
        } catch (error) {
          $('plate-error').textContent = error.message;
        }
      }
      return;
    }
    if (tools.operation.lineCut && tools.operation.polygon.length === 2) {
      const s = draftPlate();
      try {
        ui.preview = previewModelBatch([s]);
        scene.add(ui.preview);
      } catch (error) {
        $('plate-error').textContent = error.message;
      }
      return;
    }
    if (!tools.operation.frame) {
      const points = [...tools.operation.planePoints, ...(p ? [p] : [])];
      if (points.length > 1) {
        plateOutline = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(...p))),
          new THREE.LineBasicMaterial({ color: 0x258e79, depthTest: false }),
        );
        scene.add(plateOutline);
      }
      return;
    }
    let polygon = [...tools.operation.polygon];
    if (
      p &&
      (!polygon.length ||
        new THREE.Vector2(...plateLocal(tools.operation, p)).distanceTo(
          new THREE.Vector2(...polygon.at(-1)),
        ) > 1)
    )
      polygon.push(plateLocal(tools.operation, p));
    if (polygon.length) {
      const points = polygon.map((v) => new THREE.Vector3(...platePoint(tools.operation, v)));
      if (points.length > 2) points.push(points[0]);
      plateOutline = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: 0x258e79, depthTest: false }),
      );
      plateOutline.renderOrder = 11;
      scene.add(plateOutline);
    }
    const s = draftPlate(polygon);
    if (!validateObject(s)) {
      try {
        ui.preview = previewModelBatch([s]);
        scene.add(ui.preview);
      } catch (error) {
        $('plate-error').textContent = error.message;
      }
    }
  }
  function pickPlatePoint(p, exact = false) {
    let closesPolygon = false;
    if (tools.operation.frame && tools.operation.polygon?.length >= 3 && !exact) {
      const a = new THREE.Vector3(
          ...platePoint(tools.operation, tools.operation.polygon[0]),
        ).project(camera),
        b = new THREE.Vector3(...p).project(camera);
      closesPolygon =
        Math.hypot(((a.x - b.x) * host.clientWidth) / 2, ((a.y - b.y) * host.clientHeight) / 2) <
        12;
    }
    let result;
    try {
      result = advancePlatePoint(tools.operation, p, { exact, closesPolygon });
    } catch (error) {
      $('plate-error').textContent = error.message;
      return;
    }
    if (result.kind === 'vertex') {
      const error = validateSweep(result.object);
      if (error) {
        $('plate-error').textContent = error;
        return;
      }
      modelEditor.update([result.object]);
      setDrawing(false);
      render();
      $('status').textContent = 'Plate-hörn flyttat';
      return;
    }
    if (result.kind === 'finish') {
      finishPlate();
      return;
    }
    tools.operation = result.operation;
    if (result.kind === 'side') {
      $('plate-side').value = result.side;
      syncPlateUI();
      previewPlatePoint(null);
      return;
    }
    tools.first = result.first;
    if (result.kind === 'plane-point') {
      syncPlateUI();
      return;
    }
    resetLength();
    if (result.kind === 'plane') tools.axisLock = null;
    $('plate-error').textContent = '';
    syncLocks();
    syncPlateUI();
    previewPlatePoint(null);
  }

  function finishPlate() {
    if (tools.operation?.mode !== 'plateCreate' || !tools.operation.frame) return;
    const s = draftPlate(),
      error = validateSweep(s);
    if (error) {
      $('plate-error').textContent = error;
      return;
    }
    s.id = crypto.randomUUID();
    s.name = `${isLineCut(s) ? 'Linecut' : isCut(s) ? 'Polygoncut' : 'Plate'} ${String(++ui.sequence).padStart(2, '0')}`;
    if (!isCut(s)) Object.assign(s, structuredClone(ui.draftMaterial));
    Object.assign(s, nextIdentity(s, project.objects));
    modelEditor.add([s]);
    remember?.(s);
    ui.selected = s.id;
    ui.selectedIds = new Set([s.id]);
    setDrawing(false);
    fillPlate(s);
    render();
    $('status').textContent = isLineCut(s)
      ? 'Linecut skapad'
      : isCut(s)
        ? 'Polygoncut skapad'
        : 'Plate skapad';
  }
  function changePlateVertex(index, removeVertex) {
    getInspector()?.finish();
    const source = project.objects.find((s) => s.id === ui.selected);
    if (!source || tools.operation) return;
    try {
      const next = editPlateVertex(source, index, removeVertex),
        error = validateSweep(next);
      if (error) throw Error(error);
      modelEditor.update([next]);
      fillPlate(next);
      render();
      if (removeVertex) $('status').textContent = 'Hörnet borttaget';
      else {
        startPlateVertex(index + 1);
        $('status').textContent =
          'Nytt hörn · klicka för att placera med snap, Esc behåller mittpunkten';
      }
    } catch (e) {
      $('plate-error').textContent = e.message;
    }
  }
  function startPlateVertex(index) {
    const source = project.objects.find((s) => s.id === ui.selected);
    if (!isPlate(source)) return;
    setDrawing(true);
    tools.operation = { mode: 'plateVertex', source: structuredClone(source), index };
    getInspector().focusGeometry(index);
    tools.first = plateVertices(source)[index];
    syncOperationUI();
    syncPlateUI();
    syncLocks();
    renderer.domElement.focus({ preventScroll: true });
  }
  $('plate').onclick = $('plate-new').onclick = startPlate;
  $('plate-delete').onclick = remove;
  $('plate-plane').onchange = () => {
    if (tools.operation?.mode === 'plateCreate')
      startPlate(tools.operation.cutTargets, tools.operation.lineCut);
  };
  $('plate-form').addEventListener('input', () => {
    if (tools.operation?.mode === 'plateCreate') {
      previewPlatePoint(null);
      if (
        !tools.operation.cutTargets &&
        !tools.operation.lineCut &&
        $('plate-thickness').value.trim() &&
        $('plate-contour-offset').value.trim()
      )
        remember?.({ type: 'plate', ...plateValues(), ...ui.draftMaterial });
    }
  });
  $('plate-form').onsubmit = (e) => {
    e.preventDefault();
    if (tools.operation?.mode === 'plateCreate') {
      finishPlate();
      return;
    }
    if (tools.operation) return;
    const source = project.objects.find((s) => s.id === ui.selected);
    if (!isPlate(source)) return;
    const s = { ...source, polygon: source.polygon.map((p) => [...p]), ...plateValues() };
    $('plate-vertices')
      .querySelectorAll('input')
      .forEach(
        (input) => (s.polygon[+input.dataset.vertex][+input.dataset.component] = +input.value),
      );
    const error = validateSweep(s);
    if (error) {
      $('plate-error').textContent = error;
      return;
    }
    modelEditor.update([s]);
    remember?.(s);
    fillPlate(s);
    render();
    $('status').textContent = 'Plate uppdaterad';
  };
  return {
    updatePlateNormal,
    clearPlateOutline,
    syncPlateUI,
    fillPlate,
    startPlate,
    previewPlatePoint,
    pickPlatePoint,
    finishPlate,
    changePlateVertex,
    startPlateVertex,
  };
}
