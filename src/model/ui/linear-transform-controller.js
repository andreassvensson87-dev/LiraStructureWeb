import { objectType } from '../object-types/index.js';
import {
  linearDraft,
  linearVector,
  linearCount,
  pickedLinearValues,
} from '../tools/linear-transform.js';

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
  const label = (row) => (row.draft.mode === 'copy' ? 'Kopiera' : 'Flytta');
  const sync = () =>
    rows.forEach((row) =>
      row.hud.sync({
        active: row === active,
        picking: row === active && !!tools.operation?.linearPicking,
        error: row.error,
        ready: row === active && row.ready,
        coordinateSystem: row.frame ? 'Arbetsplanets axlar' : 'Globala axlar',
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
    row.frame = tools.temporaryPlane ? structuredClone(tools.temporaryPlane) : null;
    tools.operation.linearId = row.id;
    row.base = tools.operation.gripBase
      ? [...tools.operation.gripBase]
      : tools.operation.source
        ? [...(objectType(tools.operation.source).anchors(tools.operation.source)[0] || [0, 0, 0])]
        : [0, 0, 0];
    tools.first = [...row.base];
    tools.operation.linearPicking = false;
    row.lastPoint = null;
    row.error = '';
    return true;
  }
  function preview(row, picking = false) {
    if (!activate(row)) return;
    row.ready = false;
    tools.operation.linearPicking = picking;
    const snap = tools.activeSnap;
    placement.clearTransformPreview();
    try {
      const vector = linearVector(row.draft, row.frame);
      tools.operation.linearCount = linearCount(row.draft);
      tools.first = [...row.base];
      if (tools.operation.gripPlane)
        tools.operation.frame = { ...tools.operation.gripPlane, origin: [...row.base] };
      const target = vector.map((v, i) => row.base[i] + v);
      tools.typedPoint = picking ? null : target;
      tools.activeSnap = picking
        ? snap
        : { point: target, kind: 'direction', label: 'Linjär förflyttning' };
      row.ready = Math.hypot(...vector) > 1e-8 && placement.previewLinear(target);
      row.error = row.ready || Math.hypot(...vector) <= 1e-8 ? '' : 'Förflyttningen är ogiltig.';
    } catch (error) {
      placement.clearTransformPreview();
      tools.typedPoint = null;
      row.error = error.message;
    }
    status(
      row.error ||
        (picking ? 'Välj slutpunkt' : `${label(row)} linjärt · Kontrollera och bekräfta`),
    );
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
    row.lastPoint = null;
    row.ready = false;
    row.error = '';
    status('Välj startpunkt');
    sync();
    focus();
  }
  function pickPoint(point) {
    if (!active || !tools.operation?.linearPicking) return;
    if (!tools.first) {
      active.base = [...point];
      tools.first = [...point];
      if (tools.operation.gripPlane)
        tools.operation.frame = { ...tools.operation.gripPlane, origin: [...point] };
      status('Välj slutpunkt');
      return;
    }
    active.draft.values = pickedLinearValues(tools.first, point, active.frame);
    preview(active);
  }
  function pointerPreview(point) {
    if (!active || !tools.operation?.linearPicking) return;
    if (!tools.first || !point) {
      status('Välj startpunkt');
      return;
    }
    active.lastPoint = [...point];
    active.draft.values = pickedLinearValues(tools.first, point, active.frame);
    preview(active, true);
  }
  function confirm(row) {
    if (row === active && tools.operation?.linearPicking) return;
    preview(row);
    if (!row.ready) return;
    const count = linearCount(row.draft);
    if (!placement.commitPoint(linearVector(row.draft, row.frame).map((v, i) => row.base[i] + v))) {
      row.error = 'Förflyttningen kunde inte bekräftas.';
      row.ready = false;
      sync();
      return;
    }
    // Re-arm against the current selection: moved objects or the unchanged copy originals.
    if (activate(row)) {
      row.ready = true;
      sync();
    }
    status(row.draft.mode === 'copy' ? `${count} kopior skapade` : 'Markeringen flyttad');
    focus();
  }
  function refresh(row) {
    if (row === active && tools.operation?.linearPicking) {
      if (tools.first && row.lastPoint) preview(row, true);
      else sync();
    } else preview(row);
  }
  function open(mode) {
    const row = { id: Symbol(mode), draft: linearDraft(mode), ready: false, error: '' };
    rows.push(row);
    row.hud = createHUD(row.draft, {
      activate: () => preview(row),
      pick: () => pick(row),
      change: (i, value) => {
        row.draft.values[i] = value;
        preview(row);
      },
      enable: (i, enabled) => {
        row.draft.enabled[i] = enabled;
        refresh(row);
      },
      count: (value) => {
        row.draft.count = value;
        refresh(row);
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
    pick(row);
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
