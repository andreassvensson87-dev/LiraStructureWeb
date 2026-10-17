import { editPolysweepPoint } from '../insertion-point-edit.js';
import { validatePolysweep } from '../polysweep.js';
import { nextIdentity } from '../../object-identity.js';
/** Native multi-point placement; uses the existing point/snap/preview/length flow. */
export function installPolysweepTools({
  $,
  actions,
  controllers,
  modelEditor,
  project,
  renderer,
  tools,
  ui,
}) {
  function start() {
    actions.startDrawing();
    tools.operation = { mode: 'polysweepCreate', points: [] };
    actions.syncOperationUI();
    $('form').inert = false;
    sync();
    $('status').textContent = 'Polysweep · Välj punkter · Enter/skrollklick avslutar';
    renderer.domElement.focus({ preventScroll: true });
  }
  function candidate(target) {
    const points = [...tools.operation.points];
    if (
      target &&
      (!points.length || Math.hypot(...target.map((v, i) => v - points.at(-1)[i])) >= 1)
    )
      points.push([...target]);
    const source = actions.readForm();
    delete source.start;
    delete source.end;
    return { ...source, type: 'polysweep', points, radii: points.map(() => 0) };
  }
  function pick(point) {
    const points = tools.operation.points;
    if (points.length && Math.hypot(...point.map((v, i) => v - points.at(-1)[i])) < 1) return false;
    points.push([...point]);
    tools.first = [...point];
    actions.resetLength();
    actions.clearPreview();
    actions.syncLocks();
    sync();
    $('draw-length-form').hidden = false;
    $('status').textContent = `Polysweep · ${points.length} punkter · Enter/skrollklick avslutar`;
    return true;
  }
  function finish() {
    try {
      const object = actions.applyCreationAttributes?.(candidate(null)) || candidate(null),
        error = validatePolysweep(object);
      if (error) throw Error(error);
      object.id = crypto.randomUUID();
      Object.assign(
        object,
        nextIdentity(object, project.objects),
        structuredClone(ui.draftMaterial),
      );
      object.name ||= `Polysweep ${String(++ui.sequence).padStart(2, '0')}`;
      modelEditor.add([object]);
      actions.setDrawing(false);
      actions.setSelection([object.id]);
      actions.render();
      $('status').textContent = 'Polysweep skapad';
    } catch (error) {
      $('status').textContent = error.message;
    }
  }
  function removePoint() {
    tools.operation.points.pop();
    tools.first = tools.operation.points.at(-1) || null;
    actions.resetLength();
    actions.clearPreview();
    actions.syncLocks();
    sync();
    $('status').textContent =
      `Polysweep · ${tools.operation.points.length} punkter · Enter/skrollklick avslutar`;
  }
  function editPoint(index, remove) {
    try {
      const source = project.objects.find((o) => o.id === ui.selected);
      if (!source || tools.operation) return;
      modelEditor.update([editPolysweepPoint(source, index, remove)]);
      controllers.pointUI?.clear();
      actions.fillForm(project.objects.find((o) => o.id === source.id));
      actions.render();
    } catch (error) {
      $('status').textContent = error.message;
    }
  }
  function sync(preview) {
    const creating = tools.operation?.mode === 'polysweepCreate';
    $('polysweep')?.classList.toggle('active', creating);
    $('polysweep')?.setAttribute('aria-pressed', String(creating));
    const selected =
      project.objects.find((o) => o.id === ui.selected) ||
      (tools.operation?.sources?.length === 1 ? tools.operation.sources[0] : null);
    if (creating || selected?.type === 'polysweep') $('object-heading').textContent = 'Polysweep';
    if (creating) {
      $('draw-length-form').hidden = !tools.first;
      $('apply').textContent = 'Avsluta polysweep';
      $('form').inert = false;
      const source = preview || { points: tools.operation.points };
      const length = source.points
        .slice(1)
        .reduce(
          (sum, point, i) =>
            sum + Math.hypot(...point.map((v, axis) => v - source.points[i][axis])),
          0,
        );
      $('length').textContent =
        length.toLocaleString('sv-SE', { maximumFractionDigits: 3 }) + ' mm';
    }
  }
  controllers.polysweepUI = { start, candidate, pick, finish, removePoint, editPoint, sync };
}
