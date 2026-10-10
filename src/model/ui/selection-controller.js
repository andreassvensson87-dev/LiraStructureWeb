import { canSelectModelObject } from '../selection-mode.js';
import { enclosedSweeps } from '../../selection.js';
export function createSelectionController({
  host,
  renderer,
  camera,
  project,
  ui,
  getControls,
  setDrawing,
  ray,
  select,
  selectionHit,
  setSelection,
  isVisible,
}) {
  const $ = (id) => document.getElementById(id);
  // Capture quick releases even when their target is outside the canvas.
  const eventRoot = renderer.domElement.ownerDocument ?? renderer.domElement;
  const selectionBox = document.createElement('div');
  selectionBox.className = 'selection-box';
  selectionBox.hidden = true;
  host.append(selectionBox);
  function localPointer(e) {
    const r = host.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function cancelBox() {
    if (!ui.marquee) return;
    const id = ui.marquee.id;
    ui.marquee = null;
    selectionBox.hidden = true;
    getControls().enabled = true;
    if (renderer.domElement.hasPointerCapture(id)) renderer.domElement.releasePointerCapture(id);
  }
  function enableBox() {
    ui.boxMode = true;
    host.classList.add('box-selecting');
    $('box-select').classList.add('active');
    $('box-select').setAttribute('aria-pressed', 'true');
    renderer.domElement.style.cursor = 'crosshair';
  }
  $('box-select').onclick = () => {
    setDrawing(false);
    enableBox();
  };
  eventRoot.addEventListener(
    'pointermove',
    (e) => {
      if (!ui.marquee || e.pointerId !== ui.marquee.id) return;
      e.stopImmediatePropagation();
      const p = localPointer(e),
        a = ui.marquee.start;
      selectionBox.hidden = false;
      selectionBox.classList.toggle('crossing', p.x < a.x);
      Object.assign(selectionBox.style, {
        left: Math.min(a.x, p.x) + 'px',
        top: Math.min(a.y, p.y) + 'px',
        width: Math.abs(p.x - a.x) + 'px',
        height: Math.abs(p.y - a.y) + 'px',
      });
    },
    { capture: true },
  );
  eventRoot.addEventListener(
    'pointerup',
    (e) => {
      if (!ui.marquee || e.pointerId !== ui.marquee.id) return;
      e.stopImmediatePropagation();
      const m = ui.marquee,
        p = localPointer(e);
      cancelBox();
      if (Math.hypot(p.x - m.start.x, p.y - m.start.y) < 5) {
        ray(e);
        select(selectionHit(), m.additive);
      } else {
        camera.updateMatrixWorld();
        const hits = enclosedSweeps(
          project.objects.filter((s) => isVisible(s.id) && canSelectModelObject(s, ui)),
          camera,
          host.clientWidth,
          host.clientHeight,
          m.start,
          p,
          project.objects,
          { exactProfileIds: ui.exactProfileIds },
        );
        setSelection(m.additive ? [...ui.selectedIds, ...hits] : hits);
      }
      if (m.persistent) enableBox();
    },
    { capture: true },
  );
  eventRoot.addEventListener(
    'pointercancel',
    (e) => {
      if (e.pointerId === ui.marquee?.id) cancelBox();
    },
    true,
  );
  // Losing capture is not cancellation: document listeners still own this gesture.
  // A capture change can arrive before the final release when moving and releasing.
  eventRoot.defaultView?.addEventListener('blur', cancelBox);
  function beginBox(e) {
    getControls().enabled = false;
    ui.marquee = {
      id: e.pointerId,
      start: localPointer(e),
      additive: e.shiftKey,
      persistent: ui.boxMode,
    };
    renderer.domElement.setPointerCapture(e.pointerId);
  }
  return { cancelBox, enableBox, beginBox };
}
