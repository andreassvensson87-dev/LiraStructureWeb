import { workPlaneFromPoints } from '../../work-plane.js';
import { planeTransformCandidates } from '../tools/plane-transform.js';

/** Transient six-point drafts, sharing native selection, snap, preview and commit. */
export function createPlaneTransformController({
  tools,
  placement,
  setDrawing,
  createHUD,
  guides,
  status,
  focus,
}) {
  const rows = [];
  let active = null;
  const sync = () =>
    rows.forEach((row) =>
      row.hud.sync({
        active: row === active,
        start: row.start.length,
        target: row.target.length,
        picking: row.picking,
        ready: row === active && row.ready,
        error: row.error,
      }),
    );
  function suspend() {
    active = null;
    guides.clear();
    rows.forEach((row) => {
      row.ready = false;
    });
    sync();
  }
  function cancel() {
    setDrawing(false);
    suspend();
    status('Planförflyttning avbruten');
    focus();
  }
  function prompt(row) {
    const points = row[row.picking];
    status(
      `${row.picking === 'start' ? 'Startplan' : 'Målplan'} · Välj ${['origo', 'X-riktning', 'punkt i planet'][points.length]}`,
    );
  }
  function activate(row) {
    if (active === row && tools.operation?.planeId === row.id) return true;
    setDrawing(false);
    placement.startTransform(row.mode);
    if (!tools.operation?.sources?.length || tools.operation.mode !== row.mode) {
      setDrawing(false);
      row.error = 'Markera modellobjekt att flytta eller kopiera.';
      status(row.error);
      sync();
      return false;
    }
    active = row;
    tools.operation.planeId = row.id;
    row.start = [];
    row.target = [];
    row.picking = 'start';
    row.ready = false;
    row.error = '';
    prompt(row);
    sync();
    return true;
  }
  function preview(row, target = row.target) {
    placement.clearTransformPreview();
    tools.operation.planeBatch = null;
    try {
      const batch = planeTransformCandidates(tools.operation.sources, row.start, target);
      if (!placement.previewPlane(batch)) throw Error('Förflyttningen är ogiltig.');
      tools.operation.planeBatch = batch;
      row.error = '';
      return true;
    } catch (error) {
      row.error = error.message;
      return false;
    }
  }
  function pickPoint(point) {
    if (!active || !active.picking) return;
    const row = active,
      points = row[row.picking];
    try {
      if (point.length !== 3 || !point.every(Number.isFinite)) throw Error('Välj en giltig punkt.');
      if (points.length === 1 && Math.hypot(...point.map((v, i) => v - points[0][i])) < 1)
        throw Error('Välj en annan punkt för X-riktningen.');
      if (points.length === 2) workPlaneFromPoints([...points, point]);
    } catch (error) {
      row.error = error.message;
      status(row.error);
      sync();
      return false;
    }
    points.push([...point]);
    row.error = '';
    tools.first = [...point];
    guides.show(row.start, row.target);
    if (points.length === 3 && row.picking === 'start') {
      row.picking = 'target';
      tools.first = null;
    } else if (points.length === 3) {
      row.picking = null;
      row.ready = preview(row);
      status(row.error || 'Kontrollera preview · Enter bekräftar');
      sync();
      return;
    }
    prompt(row);
    sync();
  }
  function pointerPreview(point) {
    if (!active) return;
    if (!active.picking) {
      status(active.error || 'Kontrollera preview · Enter bekräftar');
      return;
    }
    if (!point) {
      prompt(active);
      return;
    }
    const row = active,
      points = [...row[row.picking], point];
    guides.show(
      row.picking === 'start' ? points : row.start,
      row.picking === 'target' ? points : [],
    );
    if (row.picking === 'target' && points.length === 3) preview(row, points);
    prompt(row);
  }
  function pick(row, which) {
    if (!activate(row)) return;
    placement.clearTransformPreview();
    tools.operation.planeBatch = null;
    row[which] = [];
    row.picking = which;
    row.ready = false;
    row.error = '';
    if (which === 'start') row.target = [];
    if (which === 'target' && row.start.length !== 3) row.picking = 'start';
    tools.first = null;
    guides.show(row.start, row.target);
    prompt(row);
    sync();
    focus();
  }
  function removePoint() {
    if (!active) return;
    const row = active;
    if (!row.picking) row.picking = 'target';
    if (!row[row.picking].length && row.picking === 'target') row.picking = 'start';
    row[row.picking].pop();
    row.ready = false;
    row.error = '';
    tools.first = row[row.picking].at(-1) || null;
    tools.operation.planeBatch = null;
    placement.clearTransformPreview();
    guides.show(row.start, row.target);
    prompt(row);
    sync();
  }
  function confirm(row) {
    if (active !== row || row.picking || !preview(row)) {
      sync();
      return;
    }
    if (!placement.commitPoint(row.target[0])) {
      row.ready = false;
      sync();
      return;
    }
    suspend();
    focus();
  }
  function open(mode) {
    const row = {
      id: Symbol(mode),
      mode,
      start: [],
      target: [],
      picking: 'start',
      ready: false,
      error: '',
    };
    rows.push(row);
    row.hud = createHUD(row, {
      activate: () => activate(row),
      pick: (which) => pick(row, which),
      confirm: () => confirm(row),
      cancel,
      close: () => {
        if (active === row) cancel();
        rows.splice(rows.indexOf(row), 1);
        row.hud.remove();
        sync();
      },
    });
    activate(row);
    focus();
  }
  return {
    open,
    suspend,
    cancel,
    pickPoint,
    pointerPreview,
    removePoint,
    canConfirm: () => !!active && active.ready && !active.picking,
    confirmActive: () => {
      if (active) confirm(active);
    },
  };
}
