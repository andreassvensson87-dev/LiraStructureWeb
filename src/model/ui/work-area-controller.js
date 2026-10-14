import { modelSelection } from '../selection-mode.js';
import { blockSelection } from '../../blocks/placement.js';
import * as THREE from 'three';
import {
  defaultWorkArea,
  workAreaFromCorners,
  workAreaBounds,
  withinWorkArea,
} from '../work-area.js';

/** Corner picking and visibility share the existing model input, HUD and renderer. */
export function createWorkAreaController({
  project,
  tools,
  ui,
  renderState,
  setDrawing,
  createHUD,
  commit,
  display,
  render,
  fit,
  status,
  focus,
  referenceVisibility,
}) {
  let hud = null,
    active = false,
    points = [],
    draft = null;
  const boundsCache = new WeakMap();
  let savedArea = null,
    savedBounds = null;
  function bounds() {
    if (active) return null;
    if (savedArea !== project.workArea) {
      savedArea = project.workArea;
      savedBounds = workAreaBounds(savedArea);
    }
    return savedBounds;
  }
  function objectBounds(id) {
    const child = renderState.renderedById.get(id)?.child;
    if (!child) return null;
    let box = boundsCache.get(child);
    if (!box) {
      child.updateWorldMatrix(true, true);
      box = new THREE.Box3().setFromObject(child);
      boundsCache.set(child, box);
    }
    return box;
  }
  const allowsObject = (id) => {
    const box = bounds(),
      object = objectBounds(id);
    return !box || !object || box.intersectsBox(object);
  };
  function sync() {
    if (draft) {
      const area = project.workArea || defaultWorkArea();
      draft = { ...draft, upper: area.upper, lower: area.lower };
    }
    referenceVisibility?.(bounds());
    display.set(bounds(), active ? workAreaBounds(draft) : null);
    hud?.sync({ active, count: points.length, ready: active && points.length === 2 && !!draft });
    if (!active && bounds()) {
      ui.selectedIds = blockSelection(
        project.objects,
        modelSelection(
          project.objects,
          project.assemblies,
          [...ui.selectedIds].filter(allowsObject),
          ui.selectionMode,
        ),
      );
      ui.selected = ui.selectedIds.size === 1 ? [...ui.selectedIds][0] : null;
    }
  }
  function suspend() {
    active = false;
    draft = null;
    points = [];
    sync();
  }
  function cancel() {
    setDrawing(false);
    suspend();
    render({ selectionOnly: true });
    status('Arbetsområde avbrutet');
    focus();
  }
  function open() {
    setDrawing(false);
    setDrawing(true);
    active = true;
    points = [];
    draft = null;
    tools.operation = {
      mode: 'workArea',
      elevation: project.levels.items.find((l) => l.id === project.levels.active)?.elevation || 0,
    };
    if (!hud)
      hud = createHUD({
        activate: open,
        pick: open,
        confirm,
        cancel,
        close: () => {
          if (active) cancel();
          hud.remove();
          hud = null;
        },
      });
    sync();
    render();
    status('Välj första hörnet i XY');
    focus();
  }
  function preview(point) {
    if (!active) return;
    draft = null;
    if (points.length === 1 && point) {
      try {
        draft = workAreaFromCorners(project.workArea || defaultWorkArea(), points[0], point);
      } catch {}
    }
    if (points.length === 2)
      draft = workAreaFromCorners(project.workArea || defaultWorkArea(), ...points);
    sync();
  }
  function pickPoint(point) {
    if (!active || points.length === 2) return;
    const p = [point[0], point[1], tools.operation.elevation];
    if (points.length === 1) {
      try {
        workAreaFromCorners(project.workArea || defaultWorkArea(), points[0], p);
      } catch (error) {
        status(error.message);
        return;
      }
    }
    points.push(p);
    tools.first = points.length === 1 ? p : null;
    preview(p);
    status(
      points.length === 1
        ? 'Välj motstående hörn i XY'
        : 'Kontrollera arbetsområdet · Enter bekräftar',
    );
  }
  function confirm() {
    if (!active || points.length !== 2 || !draft) return;
    const next = draft;
    setDrawing(false);
    suspend();
    commit(next);
    fit();
    status('Arbetsområde uppdaterat');
    focus();
  }
  function aroundSelection() {
    setDrawing(false);
    const box = new THREE.Box3();
    for (const id of ui.selectedIds) {
      const object = objectBounds(id);
      if (object) box.union(object);
    }
    if (box.isEmpty()) {
      status('Markera objekt för arbetsområdet.');
      return;
    }
    const area = project.workArea || defaultWorkArea();
    try {
      commit(
        workAreaFromCorners(
          area,
          [box.min.x - 100, box.min.y - 100],
          [box.max.x + 100, box.max.y + 100],
        ),
      );
      fit();
    } catch (error) {
      status(error.message);
    }
  }
  return {
    open,
    suspend,
    sync,
    cancel,
    pickPoint,
    pointerPreview: preview,
    confirm,
    aroundSelection,
    objectBounds,
    bounds,
    allowsObject,
    allowsPoint: (p) => withinWorkArea(bounds(), p),
    reset: () => {
      setDrawing(false);
      commit({ ...(project.workArea || defaultWorkArea()), rectangle: null });
      fit();
    },
  };
}
