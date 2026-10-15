import { objectType } from '../object-types/index.js';
import { linearDraft, linearVector, pickedLinearValues } from '../tools/linear-transform.js';

/** Coordinates HUD drafts with the native placement/preview/commit owner. */
export function createLinearTransformController({
  tools,
  placement,
  setDrawing,
  createHUD,
  status,
  focus,
}) {
  const rows = [];
  let active = null;
  const sync = () =>
    rows.forEach((row) =>
      row.hud.sync({
        active: row === active,
        picking: row === active && !!tools.operation?.linearPicking,
        error: row.error,
        ready: row === active && row.ready,
      }),
    );
  function suspend() {
    active = null;
    rows.forEach((row) => {
      row.ready = false;
    });
    sync();
  }
  function cancel() {
    setDrawing(false, { keepPoints: !!tools.operation?.gripRefs });
    suspend();
    status('Linjär förflyttning avbruten');
    focus();
  }
  function activate(row) {
    if (row === active && tools.operation?.linearId === row.id) return true;
    setDrawing(false, { keepPoints: row.draft.mode === 'move' });
    suspend();
    placement.startTransform(row.draft.mode);
    if (!tools.operation || tools.operation.mode !== row.draft.mode) {
      row.error = 'Markera objekt att flytta eller kopiera.';
      sync();
      status(row.error);
      return false;
    }
    active = row;
    tools.operation.linearId = row.id;
    row.base = tools.operation.gripBase
      ? [...tools.operation.gripBase]
      : tools.operation.source
        ? [...(objectType(tools.operation.source).anchors(tools.operation.source)[0] || [0, 0, 0])]
        : [0, 0, 0];
    tools.first = [...row.base];
    tools.operation.linearPicking = false;
    row.error = '';
    return true;
  }
  function preview(row) {
    if (!activate(row)) return;
    row.ready = false;
    tools.operation.linearPicking = false;
    placement.clearTransformPreview();
    try {
      const vector = linearVector(row.draft);
      tools.first = [...row.base];
      if (tools.operation.gripPlane)
        tools.operation.frame = { ...tools.operation.gripPlane, origin: [...row.base] };
      const target = vector.map((v, i) => row.base[i] + v);
      tools.typedPoint = target;
      tools.activeSnap = { point: target, kind: 'direction', label: 'Linjär förflyttning' };
      row.ready = Math.hypot(...vector) > 1e-8 && placement.previewLinear(target);
      row.error = row.ready || Math.hypot(...vector) <= 1e-8 ? '' : 'Förflyttningen är ogiltig.';
    } catch (error) {
      placement.clearTransformPreview();
      tools.typedPoint = null;
      row.error = error.message;
    }
    if (row.error) status(row.error);
    sync();
  }
  function pick(row) {
    if (!activate(row)) return;
    placement.clearTransformPreview();
    tools.first = null;
    tools.typedPoint = null;
    tools.axisLock = null;
    tools.operation.linearPicking = true;
    if (tools.operation.gripRefs) tools.operation.frame = null;
    row.ready = false;
    row.error = '';
    status('Välj startpunkt');
    sync();
    focus();
  }
  function pickPoint(point) {
    if (!active || !tools.operation?.linearPicking) return;
    if (!tools.first) {
      tools.first = [...point];
      if (tools.operation.gripPlane)
        tools.operation.frame = { ...tools.operation.gripPlane, origin: [...point] };
      status('Välj slutpunkt');
      return;
    }
    active.base = [...tools.first];
    active.draft.values = pickedLinearValues(tools.first, point);
    tools.operation.linearPicking = false;
    preview(active);
  }
  function pointerPreview(point) {
    if (!active || !tools.operation?.linearPicking || !tools.first || !point) return;
    placement.previewLinear(point);
  }
  function confirm(row) {
    if (row === active && tools.operation?.linearPicking) return;
    preview(row);
    if (!row.ready) return;
    if (!placement.commitPoint(linearVector(row.draft).map((v, i) => row.base[i] + v))) {
      row.error = 'Förflyttningen kunde inte bekräftas.';
      sync();
      return;
    }
    suspend();
    focus();
  }
  function open(mode) {
    const row = { id: Symbol(mode), draft: linearDraft(mode), ready: false, error: '' };
    rows.push(row);
    row.hud = createHUD(row.draft, {
      activate: () => {
        if (activate(row)) preview(row);
      },
      pick: () => pick(row),
      change: (i, value) => {
        row.draft.values[i] = value;
        preview(row);
      },
      enable: (i, enabled) => {
        row.draft.enabled[i] = enabled;
        preview(row);
      },
      confirm: () => confirm(row),
      cancel,
      close: () => {
        if (row === active) cancel();
        rows.splice(rows.indexOf(row), 1);
        row.hud.remove();
        sync();
      },
    });
    preview(row);
    return row.draft;
  }
  return {
    open,
    suspend,
    cancel,
    pickPoint,
    pointerPreview,
    confirmActive: () => {
      if (active) confirm(active);
    },
  };
}
